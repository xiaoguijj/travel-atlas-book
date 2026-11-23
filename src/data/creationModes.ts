/**
 * 兼容出口：老架构的 CreationMode 已并入新契约 BookMode（V1-05），
 * 通用贴纸系统（src/stickers）只认这个名字，这里给它指向同一个联合类型，
 * 不另立一份模式清单。
 */
export type CreationMode = import('./contracts').BookMode;
