/**
 * Parse a string that represents a git patch
 * @param  {String} contents The contents of the patch to parse
 * @return {Object}          An object where the keys are filenames, and the
 * values are the contents of the diff
 */
export function parsePatch(contents) {
  const sha = contents.split(" ")[1];
  const fileParts = contents.split(/^diff --git /m).slice(1);
  const files = {};

  fileParts.forEach((part) => {
    const start = part.indexOf("@@");
    const diffContents = part.slice(start);

    // XXX won't work with spaces in filenames
    const fileNameMatch = /^\+\+\+ b\/(.+)$/m.exec(part);

    if (! fileNameMatch) {
      // This was probably a deleted file
      return;
    }

    const fileName = fileNameMatch[1]

    const fileData = parseUnifiedDiff(diffContents);

    files[fileName] = fileData;
  });

  return {
    files,
    sha
  };
}

export function parseMultiPatch(contents) {
  const patchStart = /^From /gm;

  let match = null;
  const patchIndices = [];
  while ((match = patchStart.exec(contents)) != null) {
    patchIndices.push(match.index);
  }

  const patches = [];
  patchIndices.forEach((_, i) => {
    let patchContent = "";

    if (i + 1 < patchIndices.length) {
      patchContent = contents.slice(patchIndices[i], patchIndices[i + 1]);
    } else {
      patchContent = contents.slice(patchIndices[i]);
    }

    // Remove the weird -- 2.2.1 part at the end of every patch
    patchContent = patchContent.split(/^-- $/m)[0];
    patches.push(patchContent);
  });

  return patches.map(parsePatch);
}

export function parseUnifiedDiff(diffContents) {
  const diffLines = diffContents.split("\n");
  const lineNumbers = diffLines[0];

  // Take off first line which is just line numbers, and last line which
  // is just empty
  const contentPatchLines = diffLines.slice(1, diffLines.length - 1);
  const lineNumberMatch = /^@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/.exec(lineNumbers);

  const parsedLines = contentPatchLines.map((line) => {
    if (! line) {
      // The last line ends up being an empty string
      return null;
    }

    let type = "context";
    if (/^\+/.test(line)) {
      type = "added";
    } else if (/^-/.test(line)) {
      type = "removed";
    }

    const content = line.slice(1);

    return {
      type,
      content: content
    };
  });

  return {
    lineNumbers: {
      removed: {
        start: lineNumberMatch[1],
        lines: lineNumberMatch[2]
      },
      added: {
        start: lineNumberMatch[3],
        lines: lineNumberMatch[4]
      }
    },
    lines: parsedLines
  };
}