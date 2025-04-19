import { CAC_TIPS } from './cac-editor'

export const initTip = (tips = CAC_TIPS) => {
    const tip = document.getElementById('tip')!
    let index = 0
    tip.innerHTML = tips[index]
    setInterval(() => {
        tip.innerHTML = ''
        setTimeout(() => (tip.innerHTML = tips[++index % tips.length]), 1000)
    }, 8000)
}

export const setDataInUrl = (data: any) => {
    const url = new URL(window.location.href)
    url.searchParams.set('data', encodeURIComponent(JSON.stringify(data)))
    window.history.replaceState(null, '', url.toString())
}

export const getDataInUrl = () => {
    const urlParams = new URLSearchParams(window.location.search)
    const dataParam = urlParams.get('data')
    if (dataParam) {
        return JSON.parse(decodeURIComponent(dataParam))
    }
    return null
}
