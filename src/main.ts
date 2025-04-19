import { CacEditor, fetchPidIconSet } from './cac-editor'
import { getDataInUrl, initTip, setDataInUrl } from './util'

const myInit = async () => {
    const iconSet = await fetchPidIconSet()

    const cacEditor = new CacEditor({
        container: 'app', // id of container <div>
        width: window.innerWidth,
        height: window.innerHeight - 40,
    })

    cacEditor.initToolboxMenu({ container: '.cac-editor-toolbox', iconSet })

    // save user changes to url for easy sharing
    cacEditor.onChange(() => setDataInUrl(cacEditor.exportJson()))

    // load data from url if available
    cacEditor.importJson(getDataInUrl())
}
myInit()
initTip()
