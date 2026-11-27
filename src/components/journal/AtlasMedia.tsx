import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
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
 * 契约要求正文**只存素材 ID、可选说明、旋转角度和占几条横线**，图片字节留在照片仓储里，
 * 所以这个节点既不带 URL 也不带 Blob：显示时按 `assetId` 现取，取不到就老老实实占位。
 * 序列化的形状是 `<figure data-type="atlasMedia" data-atlas-asset="photo:xxx">`，
 * 复制粘贴、存盘、以后换云端搬的都是这串 ID。
 */

export interface AtlasMediaOptions {
  /** 素材解析由 V1-05 组装的 `AssetQuery` 提供；没传或查不到都走占位，不影响正文编辑。 */
  assets?: Pick<AssetQuery, 'getAsset'> | null;
}

type ResolveState = 'off' | 'loading' | 'ready' | 'missing';

/** 素材默认占三条横线；放大缩小时只按整条横线走，后面的字才不会从线上掉下来。 */
const DEFAULT_LINES = 3;
const MIN_LINES = 1;
/** 算不出上限（图片还没读出尺寸）时先放到这个数，够用又不会把一页撑爆。 */
const MAX_LINES = 24;
/** 旋转把手离素材顶边多远，与贴纸层保持一致 */
const ROTATE_LIFT = 20;
/** 按住 Shift 转到的角度刻度 */
const ROTATE_SNAP_DEG = 15;

function toRotation(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toLines(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_LINES
    ? Math.round(value)
    : DEFAULT_LINES;
}

/** 角度收进 (-180, 180]，存下来的数字才不会越拖越大 */
function wrapDeg(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

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
      rotation: {
        default: 0,
        parseHTML: (element) => Number(element.getAttribute('data-atlas-rotation')) || 0,
        renderHTML: (attributes) =>
          attributes.rotation ? { 'data-atlas-rotation': String(attributes.rotation) } : {},
      },
      lines: {
        default: DEFAULT_LINES,
        parseHTML: (element) => Number(element.getAttribute('data-atlas-lines')) || DEFAULT_LINES,
        renderHTML: (attributes) =>
          attributes.lines !== DEFAULT_LINES ? { 'data-atlas-lines': String(attributes.lines) } : {},
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

/** 一次按下到抬起：改大小、改角度，各管各的 */
type Gesture =
  | { kind: 'scale'; pointerId: number; centerX: number; centerY: number; startDistance: number; startLines: number; maxLines: number }
  | { kind: 'rotate'; pointerId: number; centerX: number; centerY: number; startAngle: number; startRotation: number };

/** 选中时浮在四角的四个圆钮，坐标是把手宿主的本地像素 */
interface Controls {
  duplicate: { left: number; top: number };
  remove: { left: number; top: number };
  rotate: { left: number; top: number };
  scale: { left: number; top: number };
}

/**
 * 把手宿主是 fixed 定位，最近的带 transform 的祖先（那张倾斜的纸）就是它的包含块。
 * 纸转过多少度，视口里的位移就得反向转回来，圆钮才落在素材真正的角上。
 */
function paperRotation(element: Element | null): number {
  let degrees = 0;
  for (let node = element?.parentElement; node; node = node.parentElement) {
    const transform = getComputedStyle(node).transform;
    if (transform === 'none') continue;
    const matrix = new DOMMatrixReadOnly(transform);
    degrees += (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
  }
  return degrees;
}

function sameControls(a: Controls | null, b: Controls): boolean {
  if (!a) return false;
  return (['duplicate', 'remove', 'rotate', 'scale'] as const).every((key) =>
    a[key].left === b[key].left && a[key].top === b[key].top,
  );
}

function AtlasMediaView(props: NodeViewProps) {
  const assetId = String(props.node.attrs.assetId ?? '');
  const caption = String(props.node.attrs.caption ?? '');
  const assets = resolverOf(props);
  const getAsset = assets?.getAsset;
  const [resource, setResource] = useState<AssetResource | undefined>(undefined);
  const [state, setState] = useState<ResolveState>('off');
  const src = useAssetSrc(state === 'ready' ? resource : undefined);

  const stored = {
    rotation: toRotation(props.node.attrs.rotation),
    lines: toLines(props.node.attrs.lines),
  };
  // 拖动过程中先按草稿画，抬起时才写回正文：一次手势只留一条撤销记录。
  const [draft, setDraft] = useState<typeof stored | null>(null);
  const draftRef = useRef<typeof stored | null>(null);
  const shape = draft ?? stored;
  const frameRef = useRef<HTMLSpanElement>(null);
  const handlesRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [controls, setControls] = useState<Controls | null>(null);

  const latest = useRef({ stored, updateAttributes: props.updateAttributes });
  latest.current = { stored, updateAttributes: props.updateAttributes };

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

  useEffect(() => {
    if (draft && draft.rotation === stored.rotation && draft.lines === stored.lines) setDraft(null);
  }, [draft, stored.rotation, stored.lines]);

  const handlers = useMemo(() => {
    function apply(next: { rotation: number; lines: number }) {
      draftRef.current = next;
      setDraft(next);
    }

    function move(event: PointerEvent) {
      const active = gesture.current;
      if (!active || active.pointerId !== event.pointerId) return;
      event.preventDefault();
      const dx = event.clientX - active.centerX;
      const dy = event.clientY - active.centerY;

      if (active.kind === 'scale') {
        // 离中心越远越大，比例就是把手到中心的距离比
        const next = (active.startLines * Math.hypot(dx, dy)) / active.startDistance;
        apply({ ...latest.current.stored, lines: Math.min(active.maxLines, Math.max(MIN_LINES, Math.round(next))) });
        return;
      }

      let rotation = active.startRotation + ((Math.atan2(dy, dx) - active.startAngle) * 180) / Math.PI;
      if (event.shiftKey) rotation = Math.round(rotation / ROTATE_SNAP_DEG) * ROTATE_SNAP_DEG;
      apply({ ...latest.current.stored, rotation: wrapDeg(rotation) });
    }

    function end(event?: PointerEvent) {
      const active = gesture.current;
      if (event && active && active.pointerId !== event.pointerId) return;
      gesture.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (active && draftRef.current) latest.current.updateAttributes(draftRef.current);
    }

    return { move, end };
  }, []);

  useEffect(() => () => handlers.end(), [handlers]);

  /** 开始一次手势；返回 false 表示这不是该接手的那次按下（右键、中键） */
  function begin(event: ReactPointerEvent<HTMLElement>, next: Gesture): boolean {
    if (event.pointerType === 'mouse' && event.button !== 0) return false;
    // 不让这次按下顺带把正文的光标、选区抢走
    event.preventDefault();
    event.stopPropagation();
    gesture.current = next;
    window.addEventListener('pointermove', handlers.move, { passive: false });
    window.addEventListener('pointerup', handlers.end);
    window.addEventListener('pointercancel', handlers.end);
    return true;
  }

  /** 缩放看把手离中心多远，旋转看把手绕中心转过多少，两者都绕素材自己的中心 */
  function startHandle(event: ReactPointerEvent<HTMLButtonElement>, kind: 'scale' | 'rotate') {
    const node = frameRef.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    const centerX = box.left + box.width / 2;
    const centerY = box.top + box.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const base = { pointerId: event.pointerId, centerX, centerY };

    if (kind === 'scale') {
      const image = node.querySelector('img');
      const natural = image && image.naturalWidth > 0 && image.naturalHeight > 0 ? image : null;
      const step = box.height / shape.lines;
      const available = node.closest('[contenteditable="true"]')?.clientWidth ?? 0;
      // 放到最宽也不能超过正文一行的宽度，所以按图片自己的宽高比折算出最多占几条横线
      const maxLines =
        natural && step > 0 && available > 0
          ? Math.max(MIN_LINES, Math.floor((available * natural.naturalHeight) / natural.naturalWidth / step))
          : MAX_LINES;
      begin(event, {
        ...base,
        kind: 'scale',
        startDistance: Math.max(24, Math.hypot(dx, dy)),
        startLines: shape.lines,
        maxLines,
      });
      return;
    }

    begin(event, {
      ...base,
      kind: 'rotate',
      startAngle: Math.atan2(dy, dx),
      startRotation: shape.rotation,
    });
  }

  /**
   * 四个圆钮的位置在选中期间逐帧重算：素材会转、会缩放，纸也会滚动或缩放，
   * 圆钮得跟着素材在纸上的实际落点走。数值没变就不重画。
   */
  useLayoutEffect(() => {
    if (!props.selected || !src) {
      setControls(null);
      return undefined;
    }
    let frame = 0;
    const measure = () => {
      frame = requestAnimationFrame(measure);
      const node = frameRef.current;
      const host = handlesRef.current;
      if (!node || !host) return;
      const box = node.getBoundingClientRect();
      const origin = host.getBoundingClientRect();
      const paper = (-paperRotation(host) * Math.PI) / 180;
      const pc = Math.cos(paper);
      const ps = Math.sin(paper);
      const offsetX = box.left + box.width / 2 - origin.left;
      const offsetY = box.top + box.height / 2 - origin.top;
      const centerX = offsetX * pc - offsetY * ps;
      const centerY = offsetX * ps + offsetY * pc;

      const rad = (shape.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const halfW = node.offsetWidth / 2;
      const halfH = node.offsetHeight / 2;
      const corner = (px: number, py: number) => ({
        left: centerX + px * cos - py * sin,
        top: centerY + px * sin + py * cos,
      });

      const next: Controls = {
        duplicate: corner(-halfW, -halfH),
        remove: corner(halfW, -halfH),
        rotate: corner(0, -halfH - ROTATE_LIFT),
        scale: corner(halfW, halfH),
      };
      setControls((previous) => (sameControls(previous, next) ? previous : next));
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [props.selected, src, shape.rotation, shape.lines]);

  function duplicate() {
    const position = props.getPos();
    if (position === undefined) return;
    props.editor
      .chain()
      .command(({ tr }) => {
        tr.insert(position + props.node.nodeSize, props.node.copy());
        return true;
      })
      .run();
  }

  const at = (point: { left: number; top: number }) =>
    ({ left: `${point.left}px`, top: `${point.top}px` }) as CSSProperties;

  return (
    <NodeViewWrapper className={styles.item} data-type={JOURNAL_MEDIA_NODE_NAME}>
      {src ? (
        <span
          ref={frameRef}
          className={styles.frame}
          style={{ '--media-rotation': `${shape.rotation}deg`, '--media-lines': shape.lines } as CSSProperties}
        >
          <img
            className={styles.itemImage}
            src={src}
            alt={caption || resource?.label || assetId}
            draggable={false}
          />
        </span>
      ) : (
        <p className={styles.placeholder}>{placeholderCopy(state, assetId)}</p>
      )}
      {!src ? (
        <button
          type="button"
          className={styles.itemRemove}
          aria-label="取走这一格"
          onClick={() => props.deleteNode()}
        >
          ×
        </button>
      ) : null}
      {props.selected && src ? (
        <div ref={handlesRef} className={styles.handles}>
          {controls ? (
            <>
              <button
                type="button"
                className={styles.duplicate}
                style={at(controls.duplicate)}
                tabIndex={-1}
                title="复制一份"
                aria-label="复制这一格"
                onMouseDown={(event) => event.preventDefault()}
                onClick={duplicate}
              >
                {'⧉'}
              </button>
              <button
                type="button"
                className={styles.remove}
                style={at(controls.remove)}
                tabIndex={-1}
                title="取走这一格"
                aria-label="取走这一格"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => props.deleteNode()}
              >
                {'✕'}
              </button>
              <button
                type="button"
                className={styles.rotate}
                style={at(controls.rotate)}
                tabIndex={-1}
                title="拖动旋转，按住 Shift 吸附到 15°"
                aria-label="旋转这一格"
                onPointerDown={(event) => startHandle(event, 'rotate')}
              >
                ↻
              </button>
              <button
                type="button"
                className={styles.scale}
                style={at(controls.scale)}
                tabIndex={-1}
                title="拖动缩放"
                aria-label="缩放这一格"
                onPointerDown={(event) => startHandle(event, 'scale')}
              >
                ⤢
              </button>
            </>
          ) : null}
        </div>
      ) : null}
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
