import { describe, expect, it } from 'vitest';
import {
  albumBack,
  backTargets,
  createModeBack,
  usesInnerLayout,
} from '../../../src/config/innerLayout';

describe('内页布局白名单', () => {
  it('四个栏目、城市页、手账与计划页都已接入统一布局', () => {
    for (const path of [
      '/section/journals',
      '/section/inspiration',
      '/section/plans',
      '/section/account',
      '/city/nanjing',
      '/book/abc',
      '/stamps',
      '/plan/city/nanjing',
      '/plan/new',
      '/plan/plan-1',
    ]) {
      expect(usesInnerLayout(path)).toBe(true);
    }
  });

  it('首页和未匹配的路径保持原样', () => {
    expect(usesInnerLayout('/')).toBe(false);
    expect(usesInnerLayout('/city/nanjing/create')).toBe(false);
    expect(usesInnerLayout('/book')).toBe(false);
    expect(usesInnerLayout('/plan')).toBe(false);
    expect(usesInnerLayout('/section')).toBe(false);
  });

  it('返回按钮的落点都是真实存在、且同样已接入布局的页面', () => {
    expect(backTargets.globe).toEqual({ label: '返回地球探索', to: '/' });
    expect(backTargets.journals).toEqual({ label: '返回旅行手账', to: '/section/journals' });
    expect(backTargets.plans).toEqual({ label: '返回旅行计划', to: '/section/plans' });
    expect(albumBack()).toEqual({ label: '返回邮票收藏册', to: '/section/journals' });
    expect(albumBack('nanjing')).toEqual({
      label: '返回邮票收藏册',
      to: '/section/journals?cityId=nanjing',
    });
    expect(createModeBack('abc')).toEqual({ label: '返回创作模式', to: '/book/abc' });

    for (const target of [
      backTargets.globe,
      backTargets.journals,
      backTargets.plans,
      albumBack(),
      createModeBack('abc'),
    ]) {
      if (target.to === '/') continue;
      expect(usesInnerLayout(target.to.split('?')[0])).toBe(true);
    }
  });
});
