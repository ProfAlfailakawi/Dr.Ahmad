import type { ReelPlan, ReelScene } from './reel-scenes'

export interface ReelTimelineFrameAudit {
  frame: number
  time: number
  sceneIndex: number
  sceneKind: ReelScene['kind']
  localProgress: number
  text: string[]
}

/**
 * Frame-by-frame timeline audit without Canvas or MediaRecorder.
 * It proves that every frame belongs to a complete scene/text payload at >=30fps,
 * so browser rendering can be audited deterministically before expensive export.
 */
export function sampleReelTimeline(plan: ReelPlan, fps = 30): ReelTimelineFrameAudit[] {
  const safeFps = Math.max(30, Math.round(fps))
  const total = Math.max(1, Math.round(plan.seconds * safeFps))
  const frames: ReelTimelineFrameAudit[] = []
  for (let frame = 0; frame <= total; frame += 1) {
    const time = Math.min(plan.seconds, frame / safeFps)
    let start = 0
    let index = 0
    for (; index < plan.scenes.length - 1; index += 1) {
      const end = start + plan.scenes[index].seconds
      if (time < end) break
      start = end
    }
    const scene = plan.scenes[index]
    const localProgress = Math.max(0, Math.min(1, (time - start) / Math.max(.001, scene.seconds)))
    const text = [scene.eyebrow, scene.line, scene.line2].filter((value): value is string => Boolean(value?.trim()))
    frames.push({ frame, time, sceneIndex: index, sceneKind: scene.kind, localProgress, text })
  }
  return frames
}
