import * as fs from 'fs';
import * as path from 'path';

export const DEFAULT_EXCLUDED_DIRECTORY_PATTERNS = [
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'out',
  'dist',
  'build',
  'build-*',
  'cmake-build-*',
  'cmakefiles',
  '.vscode-test',
  'tmp',
  'temp',
  'install',
];

const CPP_FILE_PATTERN = /\.(cpp|h|hpp|cc|cxx|c)$/i;

export function isCppSourceFile(fileName: string): boolean {
  return CPP_FILE_PATTERN.test(fileName);
}

export function shouldExcludeDirectory(directoryName: string, patterns: string[]): boolean {
  const normalizedName = directoryName.trim().replace(/[\\/]+$/g, '').toLowerCase();
  if (!normalizedName) {
    return false;
  }

  return patterns.some(pattern => {
    const normalizedPattern = pattern.trim().replace(/[\\/]+$/g, '').toLowerCase();
    if (!normalizedPattern) {
      return false;
    }

    if (normalizedPattern.endsWith('*')) {
      return normalizedName.startsWith(normalizedPattern.slice(0, -1));
    }

    return normalizedName === normalizedPattern;
  });
}

export function isExcludedPath(filePath: string, patterns: string[]): boolean {
  return filePath
    .split(/[\\/]+/)
    .filter(Boolean)
    .some(segment => shouldExcludeDirectory(segment, patterns));
}

export async function collectCppFilesFromDirectory(rootPath: string, patterns: string[] = DEFAULT_EXCLUDED_DIRECTORY_PATTERNS): Promise<string[]> {
  const results: string[] = [];
  const pendingDirectories = [rootPath];
  const visitedDirectories = new Set<string>([await safeRealpath(rootPath)]);

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    if (!currentDirectory) {
      continue;
    }

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(currentDirectory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        if (!shouldExcludeDirectory(entry.name, patterns)) {
          const realDirectory = await safeRealpath(fullPath);
          if (!visitedDirectories.has(realDirectory)) {
            visitedDirectories.add(realDirectory);
            pendingDirectories.push(fullPath);
          }
        }
        continue;
      }

      if (entry.isSymbolicLink()) {
        let stats: fs.Stats;
        try {
          stats = await fs.promises.stat(fullPath);
        } catch {
          continue;
        }

        if (stats.isDirectory()) {
          if (!shouldExcludeDirectory(entry.name, patterns)) {
            const realDirectory = await safeRealpath(fullPath);
            if (!visitedDirectories.has(realDirectory)) {
              visitedDirectories.add(realDirectory);
              pendingDirectories.push(fullPath);
            }
          }
          continue;
        }

        if (stats.isFile() && isCppSourceFile(entry.name)) {
          results.push(fullPath);
        }
        continue;
      }

      if (entry.isFile() && isCppSourceFile(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  return results.sort((left, right) => left.localeCompare(right));
}

async function safeRealpath(targetPath: string): Promise<string> {
  try {
    return await fs.promises.realpath(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}
