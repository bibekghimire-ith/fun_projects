/**
 * What every block editor is handed. `onChange` updates the draft (which the
 * builder autosaves on a debounce); `onCommit` asks for that save to happen
 * now, which is what a blur means.
 */
export interface EditorProps<T> {
  content: T;
  onChange: (next: T) => void;
  onCommit: () => void;
  /** The block's own media column, for the types that have one. */
  mediaId: string | null;
  onMediaChange: (mediaId: string | null) => void;
  experienceId: string;
}

export type ContentRecord = Record<string, unknown>;

/**
 * The one place a block's loosely-typed stored content is narrowed to the shape
 * its editor works in. Everything downstream of here is properly typed.
 */
export function adapt<T>(
  content: ContentRecord,
  onChange: (next: ContentRecord) => void,
): Pick<EditorProps<T>, 'content' | 'onChange'> {
  return {
    content: content as unknown as T,
    onChange: (next: T) => onChange(next as unknown as ContentRecord),
  };
}
