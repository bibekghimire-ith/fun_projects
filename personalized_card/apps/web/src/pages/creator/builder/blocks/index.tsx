import type {
  AudioBlockContent,
  BlockType,
  ButtonBlockContent,
  CountdownBlockContent,
  DividerBlockContent,
  FinalQuestionBlockContent,
  FutureLetterBlockContent,
  GalleryBlockContent,
  HeadingBlockContent,
  ImageBlockContent,
  OpenWhenBlockContent,
  QuoteBlockContent,
  TextBlockContent,
  TimelineBlockContent,
  VideoBlockContent,
} from '@letter/types';
import AudioBlockEditor from './AudioBlockEditor';
import ButtonBlockEditor from './ButtonBlockEditor';
import CountdownBlockEditor from './CountdownBlockEditor';
import DividerBlockEditor from './DividerBlockEditor';
import FinalQuestionBlockEditor from './FinalQuestionBlockEditor';
import FutureLetterBlockEditor from './FutureLetterBlockEditor';
import GalleryBlockEditor from './GalleryBlockEditor';
import HeadingBlockEditor from './HeadingBlockEditor';
import ImageBlockEditor from './ImageBlockEditor';
import OpenWhenBlockEditor from './OpenWhenBlockEditor';
import QuoteBlockEditor from './QuoteBlockEditor';
import TextBlockEditor from './TextBlockEditor';
import TimelineBlockEditor from './TimelineBlockEditor';
import VideoBlockEditor from './VideoBlockEditor';
import { adapt, type ContentRecord } from './types';

interface BlockEditorProps {
  type: BlockType;
  content: ContentRecord;
  onChange: (next: ContentRecord) => void;
  onCommit: () => void;
  mediaId: string | null;
  onMediaChange: (mediaId: string | null) => void;
  experienceId: string;
}

/** Picks the editor for a block type and hands it a properly typed content. */
export function BlockEditor({ type, content, onChange, ...rest }: BlockEditorProps) {
  switch (type) {
    case 'TEXT':
      return <TextBlockEditor {...rest} {...adapt<TextBlockContent>(content, onChange)} />;
    case 'HEADING':
      return <HeadingBlockEditor {...rest} {...adapt<HeadingBlockContent>(content, onChange)} />;
    case 'QUOTE':
      return <QuoteBlockEditor {...rest} {...adapt<QuoteBlockContent>(content, onChange)} />;
    case 'IMAGE':
      return <ImageBlockEditor {...rest} {...adapt<ImageBlockContent>(content, onChange)} />;
    case 'GALLERY':
      return <GalleryBlockEditor {...rest} {...adapt<GalleryBlockContent>(content, onChange)} />;
    case 'VIDEO':
      return <VideoBlockEditor {...rest} {...adapt<VideoBlockContent>(content, onChange)} />;
    case 'AUDIO':
      return <AudioBlockEditor {...rest} {...adapt<AudioBlockContent>(content, onChange)} />;
    case 'TIMELINE':
      return <TimelineBlockEditor {...rest} {...adapt<TimelineBlockContent>(content, onChange)} />;
    case 'COUNTDOWN':
      return <CountdownBlockEditor {...rest} {...adapt<CountdownBlockContent>(content, onChange)} />;
    case 'OPEN_WHEN':
      return <OpenWhenBlockEditor {...rest} {...adapt<OpenWhenBlockContent>(content, onChange)} />;
    case 'FUTURE_LETTER':
      return (
        <FutureLetterBlockEditor {...rest} {...adapt<FutureLetterBlockContent>(content, onChange)} />
      );
    case 'FINAL_QUESTION':
      return (
        <FinalQuestionBlockEditor
          {...rest}
          {...adapt<FinalQuestionBlockContent>(content, onChange)}
        />
      );
    case 'BUTTON':
      return <ButtonBlockEditor {...rest} {...adapt<ButtonBlockContent>(content, onChange)} />;
    case 'DIVIDER':
      return <DividerBlockEditor {...rest} {...adapt<DividerBlockContent>(content, onChange)} />;
    default:
      return null;
  }
}

/**
 * What a freshly added block starts with. Every one of these already satisfies
 * the block's content schema, so a new block saves cleanly without the creator
 * having to fill anything in first.
 */
export function defaultBlockContent(type: BlockType): ContentRecord {
  const inAWeek = new Date(Date.now() + 7 * 86_400_000).toISOString();

  switch (type) {
    case 'TEXT':
      return { text: '' };
    case 'HEADING':
      return { text: 'A new chapter', level: 2 };
    case 'QUOTE':
      return { text: 'Something worth setting apart' };
    case 'IMAGE':
      return { fit: 'cover', rounded: true };
    case 'GALLERY':
      return { mediaIds: [], layout: 'grid' };
    case 'VIDEO':
      return {};
    case 'AUDIO':
      return { isVoiceLetter: false };
    case 'TIMELINE':
      return { layout: 'vertical' };
    case 'COUNTDOWN':
      return { targetDate: inAWeek };
    case 'OPEN_WHEN':
      return {};
    case 'FUTURE_LETTER':
      return { showCountdown: true };
    case 'FINAL_QUESTION':
      return { showIntro: true };
    case 'BUTTON':
      return { text: 'Open this' };
    case 'DIVIDER':
      return { style: 'line' };
    default:
      return {};
  }
}

/** A one-line summary of a block, shown while it is collapsed. */
export function blockSummary(type: BlockType, content: ContentRecord): string {
  const text = (key: string): string => {
    const value = content[key];
    return typeof value === 'string' ? value.trim() : '';
  };

  switch (type) {
    case 'TEXT':
      return text('text') || 'Nothing written yet';
    case 'HEADING':
      return text('text') || 'An empty heading';
    case 'QUOTE':
      return text('text') || 'An empty quote';
    case 'IMAGE':
      return text('caption') || 'A photo';
    case 'GALLERY': {
      const ids = content.mediaIds;
      const count = Array.isArray(ids) ? ids.length : 0;
      return count === 0 ? 'No photos chosen yet' : `${count} photos`;
    }
    case 'VIDEO':
      return text('caption') || 'A clip';
    case 'AUDIO':
      return text('title') || (content.isVoiceLetter ? 'A voice letter' : 'Something to listen to');
    case 'TIMELINE':
      return text('title') || 'The memory timeline';
    case 'COUNTDOWN':
      return text('label') || 'A countdown';
    case 'OPEN_WHEN':
      return text('title') || 'The sealed notes';
    case 'FUTURE_LETTER':
      return 'The letter that unlocks later';
    case 'FINAL_QUESTION':
      return 'The final question';
    case 'BUTTON':
      return text('text') || 'A button';
    case 'DIVIDER':
      return 'A break';
    default:
      return '';
  }
}
