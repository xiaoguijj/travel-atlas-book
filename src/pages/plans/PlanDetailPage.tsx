import { Link, useParams } from 'react-router-dom';
import { InnerPageLayout } from '../../components/layout/InnerPageLayout';
import { backTargets } from '../../config/innerLayout';
import styles from './Plans.module.css';

/**
 * `/plan/:planId` 的行程详情占位页。计划仓储由后续任务接入；
 * 现在只说明页面归属，并给不存在的行程一条明确退路。
 */
export function PlanDetailPage() {
  const { planId } = useParams<{ planId: string }>();

  return (
    <InnerPageLayout back={backTargets.plans} maxWidth={820}>
      <div className={styles.page}>
        <header className={styles.head}>
          <p className={styles.kicker}>旅行计划 · 行程详情</p>
          <h1 className={styles.title}>行程详情正在装订</h1>
          <p className={styles.lede}>
            查看、编辑和删除行程的页面稍后接入。如果这个链接来自旧记录或别处，
            打开后没有内容也不代表数据丢了——计划存储还没开始使用。
          </p>
        </header>

        <section className={styles.placeholderCard}>
          <h2>行程编号</h2>
          <p className={styles.code}>{planId ?? '(空)'}</p>
          <p>计划数据、每日条目与关联手账会由旅行计划模块统一读写。</p>
        </section>

        <div className={styles.actions}>
          <Link className={styles.primary} to="/section/plans">
            返回愿望地图
          </Link>
          <Link className={styles.secondary} to="/">
            回到地球探索
          </Link>
        </div>
      </div>
    </InnerPageLayout>
  );
}