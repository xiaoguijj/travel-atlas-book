import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from 'react-konva';
import {
  COLLAGE_CANVAS_HEIGHT,
  COLLAGE_CANVAS_WIDTH,
  type AssetQuery,
  type CollageItem,
} from '../../data/contracts';
import { useAssetPreview } from '../assets/useAssetPreview';
import styles from './CollageView.module.css';
import { DEFAULT_TEXT_COLOR, DEFAULT_TEXT_SIZE } from './useCollageEditor';

interface CollageStageProps {
  items: CollageItem[];
  selected: CollageItem | undefined;
  assets: AssetQuery;
  onSelect: (id: string | null) => void;
  onChange: (item: CollageItem) => void;
}

const MIN_ITEM_SIZE = 16;

function keepItemReachable(node: Konva.Node) {
  const bounds = node.getClientRect({ relativeTo: node.getLayer()! });
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  // Items may overlap the page edge, but their center must stay reachable.
  const x = Math.max(MIN_ITEM_SIZE, Math.min(centerX, COLLAGE_CANVAS_WIDTH - MIN_ITEM_SIZE));
  const y = Math.max(MIN_ITEM_SIZE, Math.min(centerY, COLLAGE_CANVAS_HEIGHT - MIN_ITEM_SIZE));
  const position = { x: node.x() + (x - centerX), y: node.y() + (y - centerY) };
  node.position(position);
  return position;
}

function CanvasAsset({ item, assets }: { item: Exclude<CollageItem, { kind: 'text' }>; assets: AssetQuery }) {
  const { status, src } = useAssetPreview(item.assetId, assets);
  const [loaded, setLoaded] = useState<{ src: string; image: HTMLImageElement }>();
  const [failedSrc, setFailedSrc] = useState<string>();

  useEffect(() => {
    if (!src) return;
    const image = new window.Image();
    image.onload = () => setLoaded({ src, image });
    image.onerror = () => setFailedSrc(src);
    image.src = src;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [src]);

  const image = loaded?.src === src ? loaded?.image : undefined;
  const { width, height } = item;
  if (image) {
    const fit = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const imageWidth = image.naturalWidth * fit;
    const imageHeight = image.naturalHeight * fit;
    return (
      <KonvaImage image={image} x={(width - imageWidth) / 2} y={(height - imageHeight) / 2}
        width={imageWidth} height={imageHeight} listening={false} />
    );
  }

  const missing = status === 'missing' || status === 'error' || (src !== undefined && failedSrc === src);
  return (
    <>
      <Rect width={width} height={height} fill="#e4e4e4" listening={false} />
      <Text width={width} height={height} align="center" verticalAlign="middle"
        text={missing ? '素材缺失' : '素材加载中…'} fontSize={24} fill="#444444" listening={false} />
    </>
  );
}

function CanvasItem({ item, assets, onSelect, onChange }: {
  item: CollageItem;
  assets: AssetQuery;
  onSelect: CollageStageProps['onSelect'];
  onChange: CollageStageProps['onChange'];
}) {
  const { id, x, y, width, height, rotation } = item;
  const select = () => onSelect(id);

  function commitTransform(node: Konva.Node) {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const position = keepItemReachable(node);
    // Read only local transforms. The Stage scale is for display.
    node.scale({ x: 1, y: 1 });
    const bounds = {
      ...position, rotation: node.rotation(),
      width: width * scaleX, height: height * scaleY,
    };
    if (item.kind === 'text' && scaleX !== 1) {
      const fontSize = Math.max(1, (item.style?.fontSize ?? DEFAULT_TEXT_SIZE) * scaleX);
      onChange({ ...item, ...bounds, style: { ...item.style, fontSize } });
    } else {
      onChange({ ...item, ...bounds });
    }
  }

  return (
    <Group id={id} x={x} y={y} rotation={rotation} draggable
      onMouseDown={select} onTouchStart={select}
      onDragEnd={({ target }) => onChange({ ...item, ...keepItemReachable(target) })}
      onTransformEnd={({ target }) => commitTransform(target)}>
      <Rect width={width} height={height} fill="transparent" />
      {item.kind === 'text' ? (
        <Text width={width} height={height} text={item.text} wrap="word"
          fontSize={item.style?.fontSize ?? DEFAULT_TEXT_SIZE} fontFamily={item.style?.fontFamily ?? 'sans-serif'}
          fontStyle={`${item.style?.fontStyle === 'italic' ? 'italic' : ''} ${item.style?.fontWeight === 'bold' ? 'bold' : ''}`.trim() || 'normal'}
          fill={item.style?.color ?? DEFAULT_TEXT_COLOR} align={item.style?.align ?? 'left'} listening={false} />
      ) : (
        <CanvasAsset item={item} assets={assets} />
      )}
    </Group>
  );
}

function SelectionHandles({ selected, scale }: { selected: CollageItem | undefined; scale: number }) {
  const transformer = useRef<Konva.Transformer>(null);
  useLayoutEffect(() => {
    const control = transformer.current!;
    const node = selected && control.getLayer()?.findOne((item: Konva.Node) => item.id() === selected.id);
    if (node !== control.nodes()[0]) control.nodes(node ? [node] : []);
    // React updates a group's children after a resize, which Konva cannot track on the group itself.
    control.forceUpdate();
  }, [selected, scale]);

  return (
    <Transformer ref={transformer} flipEnabled={false} keepRatio shiftBehavior="none"
      enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
      anchorSize={14} rotateAnchorOffset={24}
      boundBoxFunc={(previous, next) => {
        const minimum = MIN_ITEM_SIZE * scale;
        return next.width < Math.min(previous.width, minimum) || next.height < Math.min(previous.height, minimum)
          ? previous
          : next;
      }} />
  );
}

export function CollageStage({ items, selected, assets, onSelect, onChange }: CollageStageProps) {
  const container = useRef<HTMLDivElement>(null);
  const [displayWidth, setDisplayWidth] = useState(0);
  const scale = displayWidth / COLLAGE_CANVAS_WIDTH;

  useLayoutEffect(() => {
    const element = container.current!;
    const measure = () => setDisplayWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function deselectOnBackground(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (event.target === event.target.getStage()) onSelect(null);
  }

  return (
    <div ref={container} className={styles.canvas} role="region" aria-label="拼贴画布">
      {scale > 0 && (
        <Stage width={displayWidth} height={COLLAGE_CANVAS_HEIGHT * scale} scaleX={scale} scaleY={scale}
          onMouseDown={deselectOnBackground} onTouchStart={deselectOnBackground}>
          <Layer>
            {items.map((item) => (
              <CanvasItem key={item.id} item={item} assets={assets} onSelect={onSelect} onChange={onChange} />
            ))}
            <SelectionHandles selected={selected} scale={scale} />
          </Layer>
        </Stage>
      )}
    </div>
  );
}
