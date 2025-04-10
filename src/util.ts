import { IPidIconSet, IPidShape, P } from './cac-editor'

export const initMenu = (iconsSet: IPidIconSet, onIconSelect: (s: IPidShape, x: number, y: number) => void) => {
    const menuIcon = document.getElementById('menu-icon')!
    const menuContainer = document.getElementById('menu-container')!
    iconsSet.data.map((icon) => {
        const iconElement = document.createElement('div')
        iconElement.className = 'menu-element'
        const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svgElement.setAttribute('viewBox', `0 0 ${icon.width + 2} ${icon.height + 1}`)
        svgElement.setAttribute('width', icon.width.toString())
        svgElement.setAttribute('height', icon.height.toString())
        svgElement.setAttribute('fill', 'none')
        svgElement.setAttribute('stroke', P.shapePathParams.stroke)
        svgElement.setAttribute('stroke-linecap', P.shapePathParams.strokeLineCap)
        svgElement.setAttribute('stroke-width', P.shapePathParams.strokeWidth.toString())

        const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        pathElement.setAttribute('d', icon.path)

        svgElement.appendChild(pathElement)
        const nameElement = document.createElement('span')
        nameElement.className = 'icon-name'
        nameElement.textContent = icon.name
        iconElement.appendChild(svgElement)
        iconElement.appendChild(nameElement)

        iconElement.addEventListener('mousedown', (event) => {
            menuContainer.style.display = 'none'
            const { x, y } = event
            onIconSelect(icon, x, y)
        })

        menuContainer.appendChild(iconElement)
    })

    menuIcon.addEventListener('click', () => {
        const isMenuVisible = menuContainer.style.display === 'block'
        menuContainer.style.display = isMenuVisible ? 'none' : 'block'
    })

    // Close the menu when clicking outside
    document.addEventListener('click', (event: any) => {
        if (!menuContainer.contains(event.target) && event.target !== menuIcon) {
            menuContainer.style.display = 'none'
        }
    })
}

const tips = ['You can select icons from the left menu', 'Double click icons to resize or rotate']
export const initTip = () => {
    const tip = document.getElementById('tip')!
    let index = 0
    tip.innerHTML = tips[index]
    setInterval(() => {
        tip.innerHTML = ''
        setTimeout(() => {
            tip.innerHTML = tips[++index % tips.length]
        }, 1000)
    }, 8000)
}
