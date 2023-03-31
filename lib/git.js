const REC = 'Receiving objects'
const RES = 'Resolving deltas'

export default function processGitData() {
  let gitResults = {
    [RES]: '0%',
    [REC]: '0%',
  }

  let GitDataProc = {}

  GitDataProc.getOutput = function(data) {
    let strData = data.toString()

    if (
      strData.indexOf(REC) > -1 ||
      strData.indexOf(RES) > -1
    ) {
      let [ status, amount ] = strData.split(':')
      let [ percent, tally ] = amount?.split('(')
      let [ count, done ] = (tally || '').split(')')

      done = done.indexOf('done') > -1

      percent = percent.trim()
      count = count.trim()

      return {
        status,
        percent,
        count,
        done,
      }
    }

    return strData
  }

  GitDataProc.printProgress = function(status, progress, done, label) {
    gitResults[status] = progress

    let msg = `\x1b[95m${REC}: ${gitResults[REC]} | ${RES}: ${gitResults[RES]}\x1b[0m`

    if (label) {
      msg = `\x1b[96m${label}\x1b[0m: ${msg}`
    }

    process.stdout.clearLine(0);
    process.stdout.cursorTo(-1);
    process.stdout.write(msg);

    if (done) {
      process.stdout.write(`\n`);
    }
  }

  return GitDataProc
}

// From https://github.com/desktop/desktop/blob/development/app/src/lib/status-parser.ts
export const GitStatusEntry = {
  Modified: 'M',
  Added: 'A',
  Deleted: 'D',
  Renamed: 'R',
  Copied: 'C',
  Unchanged: '.',
  Untracked: '?',
  Ignored: '!',
  UpdatedButUnmerged: 'U',
}

export const AppFileStatusKind = {
  New: 'New',
  Modified: 'Modified',
  Deleted: 'Deleted',
  Renamed: 'Renamed',
  Copied: 'Copied',
  Conflicted: 'Conflicted',
  Untracked: 'Untracked',
}

export const UnmergedEntrySummary = {
  AddedByUs: 'added-by-us',
  DeletedByUs: 'deleted-by-us',
  AddedByThem: 'added-by-them',
  DeletedByThem: 'deleted-by-them',
  BothDeleted: 'both-deleted',
  BothAdded: 'both-added',
  BothModified: 'both-modified'
}

export function isConflictedFileStatus(appFileStatus) {
  return appFileStatus.kind === AppFileStatusKind.Conflicted;
}

export function isConflictWithMarkers(conflictedFileStatus) {
  return conflictedFileStatus.hasOwnProperty('conflictMarkerCount'); // eslint-disable-line
}

export function isManualConflict(conflictedFileStatus) {
  return !conflictedFileStatus.hasOwnProperty('conflictMarkerCount'); // eslint-disable-line
}

/** encapsulate changes to a file associated with a commit */
export class FileChange {
  /**
  * @param path The relative path to the file in the repository.
  * @param status The status of the change to the file.
  */
  constructor(path, status) {
    this.path = path;
    this.status = status;
    if (status.kind === AppFileStatusKind.Renamed ||
      status.kind === AppFileStatusKind.Copied) {
      this.id = `${status.kind}+${path}+${status.oldPath}`;
    } else {
      this.id = `${status.kind}+${path}`;
    }
  }
}

/**
* An object encapsulating the changes to a committed file.
*
* @param status A commit SHA or some other identifier that ultimately
*               dereferences to a commit. This is the pointer to the
*               'after' version of this change. I.e. the parent of this
*               commit will contain the 'before' (or nothing, if the
*               file change represents a new file).
*/
export class CommittedFileChange extends FileChange {
  constructor(path, status, commitish) {
    super(path, status);
    this.commitish = commitish;
    this.commitish = commitish;
  }
}

export function isStatusHeader(statusItem) {
  return statusItem.kind === 'header';
}

export function isStatusEntry(statusItem) {
  return statusItem.kind === 'entry';
}

const ENTRY_TYPE_CHANGED = '1';
const ENTRY_TYPE_RENAMED_OR_COPIED = '2';
const ENTRY_TYPE_UNMERGED = 'u';
const ENTRY_TYPE_UNTRACKED = '?';
const ENTRY_TYPE_IGNORED = '!';

/** Parses output from git status --porcelain -z into file status entries */
export function parsePorcelainStatus(output) {
  const entries = new Array();
  // See https://git-scm.com/docs/git-status
  //
  // In the short-format, the status of each path is shown as
  // XY PATH1 -> PATH2
  //
  // There is also an alternate -z format recommended for machine parsing. In that
  // format, the status field is the same, but some other things change. First,
  // the -> is omitted from rename entries and the field order is reversed (e.g
  // from -> to becomes to from). Second, a NUL (ASCII 0) follows each filename,
  // replacing space as a field separator and the terminating newline (but a space
  // still separates the status field from the first filename). Third, filenames
  // containing special characters are not specially formatted; no quoting or
  // backslash-escaping is performed.
  const tokens = output.split('\0');
  const queue = new Deque(tokens);
  let field;
  while ((field = queue.shift())) {
    if (field.startsWith('# ') && field.length > 2) {
      entries.push({ kind: 'header', value: field.substr(2) });
      continue;
    }
    const entryKind = field.substr(0, 1);
    if (entryKind === ENTRY_TYPE_CHANGED) {
      entries.push(parseChangedEntry(field));
    }
    else if (entryKind === ENTRY_TYPE_RENAMED_OR_COPIED) {
      entries.push(parsedRenamedOrCopiedEntry(field, queue.shift()));
    }
    else if (entryKind === ENTRY_TYPE_UNMERGED) {
      entries.push(parseUnmergedEntry(field));
    }
    else if (entryKind === ENTRY_TYPE_UNTRACKED) {
      entries.push(parseUntrackedEntry(field));
    }
    else if (entryKind === ENTRY_TYPE_IGNORED) {
      // Ignored, we don't care about these for now
    }
  }
  return entries;
}

// 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
const changedEntryRe = /^1 ([MADRCUTX?!.]{2}) (N\.\.\.|S[C.][M.][U.]) (\d+) (\d+) (\d+) ([a-f0-9]+) ([a-f0-9]+) ([\s\S]*?)$/;
function parseChangedEntry(field) {
  const match = changedEntryRe.exec(field);
  if (!match) {
    // log.debug(`parseChangedEntry parse error: ${field}`);
    throw new Error(`Failed to parse status line for changed entry`);
  }
  return {
    kind: 'entry',
    statusCode: match[1],
    path: match[8],
  };
}

// 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path><sep><origPath>
const renamedOrCopiedEntryRe = /^2 ([MADRCUTX?!.]{2}) (N\.\.\.|S[C.][M.][U.]) (\d+) (\d+) (\d+) ([a-f0-9]+) ([a-f0-9]+) ([RC]\d+) ([\s\S]*?)$/;
function parsedRenamedOrCopiedEntry(field, oldPath) {
  const match = renamedOrCopiedEntryRe.exec(field);
  if (!match) {
    // log.debug(`parsedRenamedOrCopiedEntry parse error: ${field}`);
    throw new Error(`Failed to parse status line for renamed or copied entry`);
  }
  if (!oldPath) {
    throw new Error('Failed to parse renamed or copied entry, could not parse old path');
  }
  return {
    kind: 'entry',
    statusCode: match[1],
    oldPath,
    path: match[9],
  };
}

// u <xy> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>
const unmergedEntryRe = /^u ([DAU]{2}) (N\.\.\.|S[C.][M.][U.]) (\d+) (\d+) (\d+) (\d+) ([a-f0-9]+) ([a-f0-9]+) ([a-f0-9]+) ([\s\S]*?)$/;

function parseUnmergedEntry(field) {
  const match = unmergedEntryRe.exec(field);
  if (!match) {
    // log.debug(`parseUnmergedEntry parse error: ${field}`);
    throw new Error(`Failed to parse status line for unmerged entry`);
  }
  return {
    kind: 'entry',
    statusCode: match[1],
    path: match[10],
  };
}

function parseUntrackedEntry(field) {
  const path = field.substr(2);
  return {
    kind: 'entry',
    // NOTE: We return ?? instead of ? here to play nice with mapStatus,
    // might want to consider changing this (and mapStatus) in the future.
    statusCode: '??',
    path,
  };
}

/**
* Map the raw status text from Git to a structure we can work with in the app.
*/
export function mapStatus(status) {
  if (status === '??') {
    return {
      kind: 'untracked',
    };
  }
  if (status === '.M') {
    return {
      kind: 'ordinary',
      type: 'modified',
      index: GitStatusEntry.Unchanged,
      workingTree: GitStatusEntry.Modified,
    };
  }
  if (status === 'M.') {
    return {
      kind: 'ordinary',
      type: 'modified',
      index: GitStatusEntry.Modified,
      workingTree: GitStatusEntry.Unchanged,
    };
  }
  if (status === '.A') {
    return {
      kind: 'ordinary',
      type: 'added',
      index: GitStatusEntry.Unchanged,
      workingTree: GitStatusEntry.Added,
    };
  }
  if (status === 'A.') {
    return {
      kind: 'ordinary',
      type: 'added',
      index: GitStatusEntry.Added,
      workingTree: GitStatusEntry.Unchanged,
    };
  }
  if (status === '.D') {
    return {
      kind: 'ordinary',
      type: 'deleted',
      index: GitStatusEntry.Unchanged,
      workingTree: GitStatusEntry.Deleted,
    };
  }
  if (status === 'D.') {
    return {
      kind: 'ordinary',
      type: 'deleted',
      index: GitStatusEntry.Deleted,
      workingTree: GitStatusEntry.Unchanged,
    };
  }
  if (status === 'R.') {
    return {
      kind: 'renamed',
      index: GitStatusEntry.Renamed,
      workingTree: GitStatusEntry.Unchanged,
    };
  }
  if (status === '.R') {
    return {
      kind: 'renamed',
      index: GitStatusEntry.Unchanged,
      workingTree: GitStatusEntry.Renamed,
    };
  }
  if (status === 'C.') {
    return {
      kind: 'copied',
      index: GitStatusEntry.Copied,
      workingTree: GitStatusEntry.Unchanged,
    };
  }
  if (status === '.C') {
    return {
      kind: 'copied',
      index: GitStatusEntry.Unchanged,
      workingTree: GitStatusEntry.Copied,
    };
  }
  if (status === 'AD') {
    return {
      kind: 'ordinary',
      type: 'added',
      index: GitStatusEntry.Added,
      workingTree: GitStatusEntry.Deleted,
    };
  }
  if (status === 'AM') {
    return {
      kind: 'ordinary',
      type: 'added',
      index: GitStatusEntry.Added,
      workingTree: GitStatusEntry.Modified,
    };
  }
  if (status === 'RM') {
    return {
      kind: 'renamed',
      index: GitStatusEntry.Renamed,
      workingTree: GitStatusEntry.Modified,
    };
  }
  if (status === 'RD') {
    return {
      kind: 'renamed',
      index: GitStatusEntry.Renamed,
      workingTree: GitStatusEntry.Deleted,
    };
  }
  if (status === 'DD') {
    return {
      kind: 'conflicted',
      action: UnmergedEntrySummary.BothDeleted,
      us: GitStatusEntry.Deleted,
      them: GitStatusEntry.Deleted,
    };
  }
  if (status === 'AU') {
    return {
      kind: 'conflicted',
      action: UnmergedEntrySummary.AddedByUs,
      us: GitStatusEntry.Added,
      them: GitStatusEntry.UpdatedButUnmerged,
    };
  }
  if (status === 'UD') {
    return {
      kind: 'conflicted',
      action: UnmergedEntrySummary.DeletedByThem,
      us: GitStatusEntry.UpdatedButUnmerged,
      them: GitStatusEntry.Deleted,
    };
  }
  if (status === 'UA') {
    return {
      kind: 'conflicted',
      action: UnmergedEntrySummary.AddedByThem,
      us: GitStatusEntry.UpdatedButUnmerged,
      them: GitStatusEntry.Added,
    };
  }
  if (status === 'DU') {
    return {
      kind: 'conflicted',
      action: UnmergedEntrySummary.DeletedByUs,
      us: GitStatusEntry.Deleted,
      them: GitStatusEntry.UpdatedButUnmerged,
    };
  }
  if (status === 'AA') {
    return {
      kind: 'conflicted',
      action: UnmergedEntrySummary.BothAdded,
      us: GitStatusEntry.Added,
      them: GitStatusEntry.Added,
    };
  }
  if (status === 'UU') {
    return {
      kind: 'conflicted',
      action: UnmergedEntrySummary.BothModified,
      us: GitStatusEntry.UpdatedButUnmerged,
      them: GitStatusEntry.UpdatedButUnmerged,
    };
  }
  // as a fallback, we assume the file is modified in some way
  return {
    kind: 'ordinary',
    type: 'modified',
  };
}