import { describe, expect, it } from 'vitest';
import { backTargets, usesInnerLayout } from '../../../src/config/innerLayout';

describe('V1-03 内页布局白名单', () => {
  it('四个栏目和城市页都已接入统一布局', () => {
    for (const path of ['/section/journals', '/section/inspiration', '/section/plans', '/section/account']) {
      expect(usesInnerLayout(path)).toBe(true);
    }
    expect(usesInnerLayout('/city/nanjing')).toBe(true);
    expect(usesInnerLayout('/city/xyz')).toBe(true);
  });

  it('首页和尚未接入的页面保持原样', () => {
    // 首页用参考画舞台，画上的缎带就是它的导航
    expect(usesInnerLayout('/')).toBe(false);
    // 模式选择页（V1-06/V1-07 会加）整屏是参考画，不该被公共顶栏压住
    expect(usesInnerLayout('/city/nanjing/create')).toBe(false);
    expect(usesInnerLayout('/book/abc')).toBe(false);
    expect(usesInnerLayout('/section')).toBe(false);
  });

  it('返回按钮的落点都是这条分支上真实存在、且同样已接入布局的页面', () => {
    // 顶栏文案说"回到哪儿"，落点就得真的是那儿；点了去不了的链接比没有按钮更糟
    expect(backTargets.globe).toEqual({ label: '返回地球探索', to: '/' });
    expect(backTargets.journals).toEqual({ label: '返回旅行手账', to: '/section/journals' });
    expect(backTargets.plans).toEqual({ label: '返回旅行计划', to: '/section/plans' });

    for (const target of Object.values(backTargets)) {
      if (target.to === '/') continue;
      expect(usesInnerLayout(target.to)).toBe(true);
    }
  });

  it('Shell 与页面查的是同一份名单，不会出现两套或零套顶栏', () => {
    // App.tsx 用它决定要不要收掉 SiteHeader，页面用它决定要不要套 InnerPageLayout，
    // 所以"已接入"的路径必须恰好等于"该隐藏旧导航"的路径。
    const adopted = ['/section/journals', '/section/inspiration', '/section/plans', '/section/account', '/city/nanjing'];
    const notAdopted = ['/', '/city/nanjing/create', '/book/abc'];
    expect(adopted.every(usesInnerLayout)).toBe(true);
    expect(notAdopted.some(usesInnerLayout)).toBe(false);
  });
});
