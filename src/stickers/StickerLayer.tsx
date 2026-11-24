import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { getStickerAsset, stickerBox, stickerRatio, stickerUrl } from './catalog';
import type { StickerInstance } from './types';
import styles from './StickerLayer.module.css';

/**
 * 画布上的贴纸层，Journal 与 Collage 共用。
 *
 * 它只认实例数组和几个回调，不认识"页""横线""城市"这些概念，
 * 谁持有状态谁就用自己的存储方式接进来（Journal 用 useStickers）。
 *
 * 两个不能妥协的点：
 * - 层本身 pointer-events:none，只有贴纸像素可点，所以贴纸之间的空白照样能选字、能进正文；
 * - 按在贴纸上就 preventDefault，绝不让拖动顺带把正文的焦点和选区抢走。
 *
 * 坐标全部相对画布（百分比），拖动时按画布自己的矩形换算，
 * 所以屏幕缩放、窗口变化之后贴纸还在原来的位置。
 *
 * 缩放和旋转各用一个把手，手势期间监听挂在 window 上：
 * 上一版靠 setPointerCapture 加"事件冒泡到贴纸"两个前提，真鼠标一拖就断，
 * 因为重渲染之后把手早就不是事件目标了，移动被吞掉，贴纸只停在按下那一瞬。
 */

export interface StickerLayerProps {
  instances: StickerInstance[];
  selectedId?: string | null;
  onSelect?: (instanceId: string | null) => void;
  onUpdate: (instanceId: string, patch: Partial<StickerInstance>) => void;
  onRemove?: (instanceId: string) => void;
  onDuplicate?: (instanceId: string) => void;
  onReorder?: (instanceId: string, direction: 'forward' | 'backward') => void;
  /** 鼠标/触摸手势或键盘调整结束后，由宿主补存最终状态。 */
  onGestureEnd?: () => void;
}

/** 一次按下到抬起：拖位置、改大小、改角度，三件事各自独立 */
type Gesture =
  | { kind: 'move'; instanceId: string; pointerId: number; originX: number; originY: number; startX: number; startY: number }
  | { kind: 'scale'; instanceId: string; pointerId: number; centerX: number; centerY: number; startDistance: number; startScale: number }
  | { kind: 'rotate'; instanceId: string; pointerId: number; centerX: number; centerY: number; startAngle: number; startRotation: number };

/** 选中时浮在贴纸四角/四边上的四个把手，坐标都是层内像素 */
interface Controls {
  scale: { left: number; top: number };
  rotate: { left: number; top: number };
  duplicate: { left: number; top: number };
  remove: { left: number; top: number };
}

/** 按住 Shift 转到的角度刻度 */
const ROTATE_SNAP_DEG = 15;
/** 旋转把手离贴纸顶边多远 */
const ROTATE_LIFT = 20;

export function StickerLayer({ instances, selectedId, onSelect, onUpdate, onRemove, onDuplicate, onReorder, onGestureEnd }: StickerLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [controls, setControls] = useState<Controls | null>(null);

  const sorted = [...instances].sort((a, b) => a.z - b.z);
  const selected = sorted.find((item) => item.instanceId === selectedId) ?? null;

  /** onUpdate 每轮渲染都是新引用，window 上的回调只认最新那一个 */
  const updateRef = useRef(onUpdate);
  const gestureEndRef = useRef(onGestureEnd);
  useEffect(() => {
    updateRef.current = onUpdate;
    gestureEndRef.current = onGestureEnd;
  }, [onUpdate, onGestureEnd]);

  /**
   * 手势回调只建一次：里面全部通过 ref 取当前值，所以不会因为重渲染而换身份，
   * 加监听和摘监听用的是同一对函数。
   */
  const handlers = useMemo(() => {
    function move(event: PointerEvent) {
      const active = gesture.current;
      if (!active || active.pointerId !== event.pointerId) return;
      const canvas = rootRef.current?.getBoundingClientRect();
      if (!canvas || !canvas.width || !canvas.height) return;
      event.preventDefault();

      if (active.kind === 'move') {
        updateRef.current(active.instanceId, {
          x: active.originX + (event.clientX - active.startX) / canvas.width,
          y: active.originY + (event.clientY - active.startY) / canvas.height,
        });
        return;
      }

      const dx = event.clientX - active.centerX;
      const dy = event.clientY - active.centerY;
      if (active.kind === 'scale') {
        // 离中心越远越大，比例就是把手到中心的距离比
        updateRef.current(active.instanceId, { scale: (active.startScale * Math.hypot(dx, dy)) / active.startDistance });
        return;
      }

      let rotation = active.startRotation + ((Math.atan2(dy, dx) - active.startAngle) * 180) / Math.PI;
      if (event.shiftKey) rotation = Math.round(rotation / ROTATE_SNAP_DEG) * ROTATE_SNAP_DEG;
      updateRef.current(active.instanceId, { rotation: wrapDeg(rotation) });
    }

    function end(event?: PointerEvent) {
      const active = gesture.current;
      if (event && active && active.pointerId !== event.pointerId) return;
      gesture.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (active) gestureEndRef.current?.();
    }

    return { move, end };
  }, []);

  useEffect(
    () => () => {
      handlers.end();
    },
    [handlers],
  );

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

  /** 点空白取消选中：监听挂在画布上，因为层自己不接收事件 */
  useEffect(() => {
    const host = rootRef.current?.parentElement;
    if (!host || !onSelect) return undefined;
    const handler = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && target.closest('[data-sticker],[data-sticker-controls]')) return;
      onSelect(null);
    };
    host.addEventListener('pointerdown', handler);
    return () => host.removeEventListener('pointerdown', handler);
  }, [onSelect]);

  /** 键盘删除与退出选中，但光标在文字里时绝不插手——那是在打字，不是在删贴纸 */
  useEffect(() => {
    if (!selectedId) return undefined;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))) return;
      if (event.key === 'Escape') onSelect?.(null);
      if ((event.key === 'Delete' || event.key === 'Backspace') && onRemove) {
        event.preventDefault();
        onRemove(selectedId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, onSelect, onRemove]);

  /**
   * 四个把手的位置每轮重算：贴纸会转，角上的点在层里就得按旋转矩阵推出来，
   * 直接拿 getBoundingClientRect 的角会落到外接矩形上，看着是飘的。
   */
  useLayoutEffect(() => {
    const root = rootRef.current;
    const node = selectedRef.current;
    if (!root || !node || !selected) {
      setControls(null);
      return;
    }
    const box = node.getBoundingClientRect();
    const host = root.getBoundingClientRect();
    const centerX = box.left - host.left + box.width / 2;
    const centerY = box.top - host.top + box.height / 2;
    // offsetWidth/Height 是变换之前的尺寸，配合中心点就能算出真正的四个角
    const halfW = node.offsetWidth / 2;
    const halfH = node.offsetHeight / 2;
    const rad = (selected.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const corner = (px: number, py: number) => ({ left: centerX + px * cos - py * sin, top: centerY + px * sin + py * cos });

    setControls({
      scale: corner(halfW, halfH),
      rotate: corner(0, -halfH - ROTATE_LIFT),
      duplicate: corner(-halfW, -halfH),
      remove: corner(halfW, -halfH),
    });
    // selected 的 x/y/scale/rotation 变了都会让 instances 换引用，跟着重算就够
  }, [instances, selected]);

  function startMove(event: ReactPointerEvent<HTMLDivElement>, instance: StickerInstance) {
    const started = begin(event, {
      kind: 'move',
      instanceId: instance.instanceId,
      pointerId: event.pointerId,
      originX: instance.x,
      originY: instance.y,
      startX: event.clientX,
      startY: event.clientY,
    });
    if (started) onSelect?.(instance.instanceId);
  }

  /** 缩放看把手离中心多远，旋转看把手绕中心转过多少，两者都绕贴纸自己的中心 */
  function startHandle(event: ReactPointerEvent<HTMLButtonElement>, instance: StickerInstance, kind: 'scale' | 'rotate') {
    const node = selectedRef.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    const centerX = box.left + box.width / 2;
    const centerY = box.top + box.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const base = { instanceId: instance.instanceId, pointerId: event.pointerId, centerX, centerY };
    begin(
      event,
      kind === 'scale'
        ? { ...base, kind: 'scale', startDistance: Math.max(24, Math.hypot(dx, dy)), startScale: instance.scale }
        : { ...base, kind: 'rotate', startAngle: Math.atan2(dy, dx), startRotation: instance.rotation },
    );
  }

  return (
    <div ref={rootRef} className={styles.layer} data-sticker-layer="">
      {sorted.map((instance, index) => (
        <Sticker
          key={instance.instanceId}
          instance={instance}
          index={index}
          selected={instance.instanceId === selectedId}
          nodeRef={instance.instanceId === selectedId ? selectedRef : undefined}
          onPointerDown={startMove}
          onSelect={onSelect}
          onUpdate={onUpdate}
          onReorder={onReorder}
          onGestureEnd={onGestureEnd}
        />
      ))}

      {selected && controls ? (
        <div className={styles.controls} data-sticker-controls="">
          {onDuplicate ? (
            <button
              type="button"
              className={styles.duplicate}
              style={{ left: `${controls.duplicate.left}px`, top: `${controls.duplicate.top}px` }}
              tabIndex={-1}
              title="复制一份"
              aria-label="复制这张贴纸"
              onClick={() => onDuplicate(selected.instanceId)}
            >
              {'⧉'}
            </button>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              className={styles.remove}
              style={{ left: `${controls.remove.left}px`, top: `${controls.remove.top}px` }}
              tabIndex={-1}
              title="撕掉这张贴纸"
              aria-label="删除这张贴纸"
              onClick={() => onRemove(selected.instanceId)}
            >
              {'✕'}
            </button>
          ) : null}

          <button
            type="button"
            className={styles.rotate}
            style={{ left: `${controls.rotate.left}px`, top: `${controls.rotate.top}px` }}
            tabIndex={-1}
            title="拖动旋转，按住 Shift 吸附到 15°"
            aria-label="旋转这张贴纸：按住拖动绕中心转，方向键 [ 和 ] 每次 5°"
            onPointerDown={(event) => startHandle(event, selected, 'rotate')}
          >
            ↻
          </button>
          <button
            type="button"
            className={styles.scale}
            style={{ left: `${controls.scale.left}px`, top: `${controls.scale.top}px` }}
            tabIndex={-1}
            title="拖动缩放"
            aria-label="缩放这张贴纸：按住往外拖放大、往里拖缩小，加号减号每次 8%"
            onPointerDown={(event) => startHandle(event, selected, 'scale')}
          >
            ⤢
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface StickerProps {
  instance: StickerInstance;
  index: number;
  selected: boolean;
  nodeRef?: RefObject<HTMLDivElement>;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>, instance: StickerInstance) => void;
  onSelect?: (instanceId: string | null) => void;
  onUpdate: (instanceId: string, patch: Partial<StickerInstance>) => void;
  onReorder?: (instanceId: string, direction: 'forward' | 'backward') => void;
  onGestureEnd?: () => void;
}

function Sticker({ instance, index, selected, nodeRef, onPointerDown, onSelect, onUpdate, onReorder, onGestureEnd }: StickerProps) {
  const asset = getStickerAsset(instance.assetId);
  if (!asset) return null;

  const box = stickerBox(instance.assetId, instance.scale);
  const style = {
    left: `${(instance.x * 100).toFixed(3)}%`,
    top: `${(instance.y * 100).toFixed(3)}%`,
    width: `${(box.w * 100).toFixed(3)}%`,
    aspectRatio: String(stickerRatio(instance.assetId)),
    transform: `translate(-50%, -50%) rotate(${instance.rotation.toFixed(2)}deg)`,
    zIndex: 10 + index,
  } as CSSProperties;

  /**
   * 键盘走的是同一条 update：焦点在贴纸上时 +/− 缩放、[ ] 旋转，
   * 这样把手不只是给鼠标看的装饰，键盘用户也能把贴纸摆正。
   * 前后层没有圆点了（Shift+↑↓ 接手），否则这个能力在界面上就只剩 Collage 用得到。
   */
  function handleKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.(instance.instanceId);
      return;
    }
    if (event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      onReorder?.(instance.instanceId, event.key === 'ArrowUp' ? 'forward' : 'backward');
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      onUpdate(instance.instanceId, { scale: instance.scale * 1.08 });
      return;
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      onUpdate(instance.instanceId, { scale: instance.scale / 1.08 });
      return;
    }
    if (event.key === '[' || event.key === ']') {
      event.preventDefault();
      const step = (event.shiftKey ? 1 : 5) * (event.key === ']' ? 1 : -1);
      onUpdate(instance.instanceId, { rotation: wrapDeg(instance.rotation + step) });
    }
  }

  return (
    <div
      ref={nodeRef}
      data-sticker={instance.instanceId}
      className={selected ? `${styles.sticker} ${styles.selected}` : styles.sticker}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={`${asset.name}贴纸，按住拖动可移动${selected ? '；左上复制、右上删除、上方旋转、右下缩放，键盘上 + − [ ] 与 Shift 方向键' : ''}`}
      onPointerDown={(event) => onPointerDown(event, instance)}
      onFocus={() => onSelect?.(instance.instanceId)}
      onKeyDown={handleKey}
      onKeyUp={(event) => {
        if (['+', '=', '-', '_', '[', ']'].includes(event.key)) onGestureEnd?.();
      }}
    >
      <img src={stickerUrl(asset.id)} alt={asset.name} draggable={false} loading="lazy" decoding="async" />
    </div>
  );
}

/** 角度收进 (-180, 180]，存下来的数字才不会越拖越大 */
function wrapDeg(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}
