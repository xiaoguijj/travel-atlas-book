import { useEffect, useState } from 'react';
import styles from './PageTurn.module.css';

const TURN_MS = 620;

/**
 * 翻页遮罩：新的一页挂载时，一张纸从左侧线圈那边翻过去，把旧页换掉。
 *
 * 纸盖住屏幕的那一半时间正好够路由换完内容，所以看起来就是"翻过一页"而不是"闪了一下"。
 * 只在挂载时播一次；开了「减少动态效果」时全局动画被压到 1ms，纸立刻翻完并卸载。
 */
export function PageTurn() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), TURN_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.turn} aria-hidden="true">
      <div className={styles.sheet} />
      <div className={styles.shade} />
    </div>
  );
}
