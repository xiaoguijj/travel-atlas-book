import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { useEffect, useState } from 'react';
import {
  JOURNAL_MEDIA_NODE_NAME,
  type AssetQuery,
  type AssetResource,
  type StickerAssetResource,
} from '../../data/contracts';
import styles from './AtlasMedia.module.css';

/**
 * Journal 里的媒体块（V1-07）。
 *
 * 契约要求正文**只存素材 ID 与可选说明**（`JournalMediaAttrs`），图片字节留在照片仓储里，
 * 所以这个节点既不带 URL 也不带 Blob：显示时按 `assetId` 现取，取不到就老老实实占位。
 * 序列化的形状是 `<figure data-type="atlasMedia" data-atlas-asset="photo:xxx">`，
 * 复制粘贴、存盘、以后换云端搬的都是这串 ID。
 */

export interface AtlasMediaOptions {
  /** 素材解析由 V1-05 组装的 `AssetQuery` 提供；没传或查不到都走占位，不影响正文编辑。 */
  assets?: Pick<AssetQuery, 'getAsset'> | null;
}

type ResolveState = 'off' | 'loading' | 'ready' | 'missing';

export const AtlasMedia = Node.create<AtlasMediaOptions>({
  name: JOURNAL_MEDIA_NODE_NAME,
  group: 'block',
  atom: true,

  addOptions() {
    return { assets: null };
  },

  addAttributes() {
    return {
      assetId: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-atlas-asset') ?? '',
        renderHTML: (attributes) => ({ 'data-atlas-asset': String(attributes.assetId ?? '') }),
      },
      caption: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-atlas-caption') ?? '',
        renderHTML: (attributes) =>
          attributes.caption ? { 'data-atlas-caption': String(attributes.caption) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: `figure[data-type="${JOURNAL_MEDIA_NODE_NAME}"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    // HTMLAttributes 已经是 addAttributes 里 renderHTML 换算出来的那串 data-* 键，
    // 再把 node.attrs 整个并进去会多出一份 camelCase 重复属性。
    return ['figure', mergeAttributes(HTMLAttributes, { 'data-type': JOURNAL_MEDIA_NODE_NAME })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AtlasMediaView);
  },
});

/** 从编辑器实例里把这次挂载用的素材解析器捞出来（扩展 options 是唯一的传递通道）。 */
function resolverOf(props: NodeViewProps): Pick<AssetQuery, 'getAsset'> | undefined {
  const extension = props.editor.extensionManager.extensions.find((item) => item.name === JOURNAL_MEDIA_NODE_NAME);
  return (extension?.options as AtlasMediaOptions | undefined)?.assets ?? undefined;
}

function AtlasMediaView(props: NodeViewProps) {
  const assetId = String(props.node.attrs.assetId ?? '');
  const caption = String(props.node.attrs.caption ?? '');
  const assets = resolverOf(props);
  const getAsset = assets?.getAsset;
  const [resource, setResource] = useState<AssetResource | undefined>(undefined);
  const [state, setState] = useState<ResolveState>('off');
  const src = useAssetSrc(state === 'ready' ? resource : undefined);

  useEffect(() => {
    if (!getAsset || !assetId) {
      setState('off');
      setResource(undefined);
      return;
    }
    let alive = true;
    setState('loading');
    getAsset(assetId)
      .then((found) => {
        if (!alive) return;
        setResource(found);
        setState(found ? 'ready' : 'missing');
      })
      .catch(() => {
        if (!alive) return;
        setResource(undefined);
        setState('missing');
      });
    return () => {
      alive = false;
    };
  }, [assetId, getAsset]);

  const isSticker = assetId.startsWith('sticker:');

  if (isSticker) {
    return (
      <NodeViewWrapper
        className={props.selected ? `${styles.sticker} ${styles.stickerSelected}` : styles.sticker}
        data-type={JOURNAL_MEDIA_NODE_NAME}
      >
        {src ? (
          <img
            className={styles.stickerImage}
            src={src}
            alt={caption || resource?.label || assetId}
            draggable={false}
          />
        ) : (
          <p className={styles.placeholder}>{placeholderCopy(state, assetId)}</p>
        )}
        {props.selected || !src ? (
          <button
            type="button"
            className={styles.stickerRemove}
            aria-label="取走这一格"
            onClick={() => props.deleteNode()}
          >
            ×
          </button>
        ) : null}
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className={props.selected ? `${styles.block} ${styles.blockSelected}` : styles.block}
      data-type={JOURNAL_MEDIA_NODE_NAME}
    >
      {src ? (
        <img className={styles.thumb} src={src} alt={caption || resource?.label || assetId} draggable={false} />
      ) : null}

      <div className={styles.meta}>
        {src ? null : <p className={styles.placeholder}>{placeholderCopy(state, assetId)}</p>}

        <input
          className={styles.caption}
          value={caption}
          onChange={(event) => props.updateAttributes({ caption: event.target.value })}
          placeholder="给这一格写一句说明（可以不填）"
          aria-label="素材说明"
          maxLength={60}
        />

        <span className={styles.assetId}>{assetId || '没有素材编号'}</span>
      </div>

      <button type="button" className={styles.remove} onClick={() => props.deleteNode()}>
        取走这一格
      </button>
    </NodeViewWrapper>
  );
}

function placeholderCopy(state: ResolveState, assetId: string): string {
  if (state === 'loading') return '正在取这一格的素材…';
  if (state === 'missing') return `本机素材库里没有「${assetId}」，先占位，素材回来就自动补上。`;
  return '素材面板还没接上（归 V1-05），这一格先按编号占位。';
}

/**
 * 照片的 Blob 只在显示期间换一个 object URL，卸载即释放——
 * 正文里不许留持久 URL，预览 URL 的生命周期归用它的这一格自己管。
 */
function useAssetSrc(resource: AssetResource | undefined): string | undefined {
  const [objectUrl, setObjectUrl] = useState<string | undefined>(undefined);
  const stickerSrc = resource?.kind === 'sticker' ? (resource as StickerAssetResource).src : undefined;

  useEffect(() => {
    if (!resource || resource.kind !== 'photo') {
      setObjectUrl(undefined);
      return;
    }
    const created = URL.createObjectURL(resource.blob);
    setObjectUrl(created);
    return () => {
      URL.revokeObjectURL(created);
      setObjectUrl(undefined);
    };
  }, [resource]);

  return stickerSrc ?? objectUrl;
}
