import { CacEditor, fetchPidIconSet, IPidShape } from './cac-editor'
import { initMenu, initTip } from './util'

const init = async () => {
    const pidIconSet = await fetchPidIconSet()
    const cacEditor = new CacEditor()
    initMenu(pidIconSet, (shape: IPidShape, x: number, y: number) => {
        cacEditor.addShape(shape, x, y)
    })
}
init()
initTip()
