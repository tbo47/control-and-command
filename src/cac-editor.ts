import { Group } from 'konva-es/lib/Group'
import { Layer } from 'konva-es/lib/Layer'
import { Shape } from 'konva-es/lib/Shape'
import { Circle } from 'konva-es/lib/shapes/Circle'
import { Line, LineConfig } from 'konva-es/lib/shapes/Line'
import { Path } from 'konva-es/lib/shapes/Path'
import { Rect } from 'konva-es/lib/shapes/Rect'
import { Text } from 'konva-es/lib/shapes/Text'
import { Transformer } from 'konva-es/lib/shapes/Transformer'
import { Stage, StageConfig, stages } from 'konva-es/lib/Stage'
import { Vector2d } from 'konva-es/lib/types'

export const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

export type PIDIconType =
    | 'valve'
    | 'pump'
    | 'compressor'
    | 'heat-exchanger'
    | 'separator'
    | 'tank'
    | 'pipe'
    | 'fitting'
    | 'instrument'
    | 'control-valve'

export interface IPidAnchor {
    type: 'in' | 'out' | 'in-out'
    x: number
    y: number
}

/**
 * Defines the structure of a PID shape.
 * It's readonly.
 */
export interface IPidShape {
    name: string
    path: string
    height: number
    width: number
    type: PIDIconType
    anchors: IPidAnchor[]
}

export interface IPidIconSet {
    dataset?: string
    description?: string
    author?: string
    license?: string
    version?: string
    data: IPidShape[]
}

export interface CacEditorConfig extends StageConfig {}

interface IConnector {
    line: Line
    anchorIndex: number
    shape: Path
    type: 'start' | 'end'
}

const PID_DATASET_URL = 'https://raw.githubusercontent.com/tbo47/open-pid-icons/refs/heads/main/open-pid-icons.json'

/**
 * Fetches the PID icons from https://github.com/tbo47/open-pid-icons
 */
export const fetchPidIconSet = async (url = PID_DATASET_URL) => {
    const response = await fetch(url)
    const pidIconSet = (await response.json()) as IPidIconSet
    pidIconSet.data.forEach((item: IPidShape) => {
        item.anchors = item.anchors || []
        item.path = item.path || ''
        item.type = item.type || 'valve'
        item.name = item.name || 'Unnamed'
    })
    return pidIconSet
}

export const P = {
    anchor: {
        color: 'lightgray',
        radius: isTouchDevice ? 12 : 5,
        radiusOver: isTouchDevice ? 40 : 9,
    },
    shapePathParams: {
        stroke: 'black',
        strokeWidth: 1.4,
        strokeLineCap: 'round',
    },
    textParams: {
        fontSize: 12,
        fill: 'black',
        x: 0,
        y: -24,
    },
    lineParams: {
        stroke: 'black',
        strokeWidth: 1.4,
        lineCap: 'round',
        lineJoin: 'round',
    } as LineConfig,
}

/**
 * CacEditor is a class that creates a canvas editor for PID icons.
 * It initializes a Konva stage and allows the user to drag and drop PID icons onto the canvas.
 * The icons can be resized and moved around the canvas.
 */
export class CacEditor {
    private stage: Stage
    private layer: Layer
    private tr: Transformer

    constructor(config: CacEditorConfig) {
        this.stage = new Stage(config)
        this.layer = new Layer()
        this.stage.add(this.layer)
        this.tr = new Transformer({
            keepRatio: true,
            enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
            boundBoxFunc: (oldBox, newBox) => {
                const ratio = oldBox.width / oldBox.height
                newBox.width = Math.max(80, newBox.width)
                newBox.height = newBox.width / ratio
                if (newBox.height < 10) {
                    newBox.height = 10
                    newBox.width = newBox.height * ratio
                }
                return newBox
            },
        })

        // pidIconSet.data.map((item) => this.addShape(item))
        this.init()
    }

    #createAnchorShapes(pidShape: IPidShape, icon: Path) {
        this.#cleanAnchorShapes()
        const { x, y } = icon.getClientRect({ relativeTo: this.layer })
        return pidShape.anchors.map((anchor, anchorIndex) => {
            const anchorShape = new Circle({
                x: anchor.x + x,
                y: anchor.y + y,
                radius: P.anchor.radius,
                fill: P.anchor.color,
                name: 'cacAnchor',
            })
            anchorShape.on('mouseover touchover', () => anchorShape.radius(P.anchor.radiusOver))
            anchorShape.on('mouseout touchout', () => anchorShape.radius(P.anchor.radius))
            anchorShape.on('mouseup touchend', () => {
                const pos = anchorShape.absolutePosition()
                const line = this.#endConnectingLine(pos)
                if (line) this.#addConnectorToPath(icon, line, anchorIndex, 'end')
            })
            anchorShape.on('mousedown touchstart', () => {
                const line = this.layer.findOne('.currentline') as Line | undefined
                if (!line) {
                    const pos = anchorShape.absolutePosition()
                    const newLine = new Line({
                        points: [pos.x, pos.y],
                        ...P.lineParams,
                        name: 'currentline',
                    })
                    newLine.setAttr('cacAnchorIndexStart', anchorIndex)
                    newLine.setAttr('pidShapeStart', pidShape)
                    newLine.setAttr('pathStart', icon)
                    this.layer.add(newLine)
                }
            })
            this.layer.add(anchorShape)
            anchorShape.moveToTop()
            return anchorShape
        })
    }

    #endConnectingLine(pos: Vector2d) {
        const line = this.layer.findOne('.currentline') as Line | undefined
        if (line) {
            generatePoints(line, pos)
            line.name('cacConnectorTwoPidShape')
            this.#cleanAnchorShapes()
            const anchorIndexStart = line.getAttr('cacAnchorIndexStart') as number
            // const pidStart = line.getAttr('pidShapeStart') as IPidShape
            const shapeStart = line.getAttr('pathStart') as Path
            this.#addConnectorToPath(shapeStart, line, anchorIndexStart, 'start')
        }
        return line
    }

    #addConnectorToPath(shape: Path, line: Line, anchorIndex: number, type: 'start' | 'end') {
        if (!shape.getAttr('connectors')) shape.setAttr('connectors', [])
        shape.getAttr('connectors').push({ line, anchorIndex, shape, type } as IConnector)
    }

    #cleanAnchorShapes() {
        this.layer.find('.cacAnchor').forEach((shape) => shape.destroy())
    }

    addShape(pidShape: IPidShape, x: number, y: number) {
        const group = new Group({ x, y, draggable: true })
        const icon = new Path({ data: pidShape.path, name: 'pidshapename', ...P.shapePathParams })
        icon.setAttr('pidShape', pidShape)
        group.on('click tap', () => {
            this.tr.nodes([])
            this.#createAnchorShapes(pidShape, icon)
        })
        group.add(icon)
        const text = new Text({ text: pidShape.name, ...P.textParams })
        group.add(text)
        {
            const { x, y, width, height } = icon.getClientRect({ relativeTo: group })
            text.x(width / 2 - text.width() / 2)
            const box = new Rect({
                x: Math.min(text.x(), x),
                y: Math.min(text.y(), y),
                width: Math.max(text.x() + text.width(), x + width) - Math.min(text.x(), x),
                height: Math.max(text.y() + text.height(), y + height) - Math.min(text.y(), y),
                fill: 'transparent',
            })
            group.add(box)
        }
        group.on('mouseover touchmove', (e) => {
            const line = this.layer.findOne('.currentline') as Line | undefined
            if (line) {
                this.#createAnchorShapes(pidShape, icon)
            } else {
                e.target.getStage()!.container().style.cursor = 'move'
            }
        })
        group.on('mousedown touchstart', () => this.#cleanAnchorShapes())
        group.on('mouseout touchout', (e) => {
            e.target.getStage()!.container().style.cursor = 'default'
        })
        group.on('dragmove', () => {
            const connectors = icon.getAttr('connectors') as IConnector[]
            if (!connectors) return
            connectors.forEach((c: IConnector) => {
                const g = group.absolutePosition()
                const anchor = pidShape.anchors[c.anchorIndex]
                g.x = g.x + anchor.x
                g.y = g.y + anchor.y
                // c.line.points([c.anchor.x(), c.anchor.y(), ...generatePoints(c.line, c.anchor.absolutePosition())])
                if (c.type === 'end') {
                    generatePoints(c.line, g)
                } else {
                    const endX = c.line.points().at(-2)!
                    const endY = c.line.points().at(-1)!
                    const startX = c.line.points().at(0)!
                    const middleX = (startX + endX) / 2
                    const points = [g.x, g.y, middleX, g.y, middleX, endY, endX, endY]
                    c.line.points(points)
                }
            })
        })
        group.on('dragend', () => {
            this.#fire()
        })
        this.layer.add(group)
        return group
    }

    #eventHandler: (() => void)[] = []
    #fire() {
        this.#eventHandler.forEach((callback) => callback())
    }
    /**
     * This method allows you to register a callback function that will be called whenever the canvas is changed.
     * This is useful for updating the state of your application or saving the current state of the canvas.
     * @param callback - The callback function to be called on change.
     */
    onChange(callback: () => void) {
        this.#eventHandler.push(callback)
    }

    #export() {
        const shapes = this.layer.find('.pidshapename')
        return shapes.map((shape) => {
            const pidShape = shape.getAttr('pidShape') as IPidShape
            const position = shape.absolutePosition()
            return { pidShape, position }
        })
    }

    exportJson() {
        return this.#export()
    }

    importJson(data: { pidShape: IPidShape; position: Vector2d }[] | null) {
        if (!data) return
        // this.layer.destroyChildren()
        data.forEach((item) => {
            const { pidShape, position } = item
            this.addShape(pidShape, position.x, position.y)
            /*
            const group = this.addShape(pidShape, position.x, position.y)
            const icon = group.findOne('.pidshapename') as Path
            const connectors = pidShape.anchors.map((anchor, anchorIndex) => {
                return { line: new Line(), anchorIndex, shape: icon, type: 'start' }
            })
            icon.setAttr('connectors', connectors)
            */
        })
        this.layer.draw()
    }

    #createEmtpyShape(pos: Vector2d) {
        const emptyEnd: IPidShape = {
            name: '',
            anchors: [
                { type: 'in-out', x: 0, y: 7 },
                { type: 'in-out', x: 14, y: 7 },
            ],
            path: 'm 0 0 a 5 5 0 0 1 14 0 a 5 5 0 0 1 -14 0',
            height: 10,
            width: 10,
            type: 'valve',
        }
        const group = this.addShape(emptyEnd, pos.x, pos.y)
        return group.children.find((c) => c.attrs.data) as Path
    }

    init() {
        this.stage.on('click tap', (e) => {
            if (e.target === this.stage) {
                this.tr.nodes([])
                this.#cleanAnchorShapes()
                const pos = this.stage.getPointerPosition()
                if (!pos) this.layer.findOne('.currentline')?.destroy()
                else if (this.layer.findOne('.currentline')) {
                    const line = this.#endConnectingLine(pos)
                    const emptyEnd = this.#createEmtpyShape(pos)
                    if (line) this.#addConnectorToPath(emptyEnd, line, 0, 'end')
                }
            }
        })
        this.layer.add(this.tr)
        this.layer.draw()
        this.stage.on('mousemove touchmove', () => {
            const pos = this.stage.getPointerPosition()
            if (!pos) return
            const line = this.layer.findOne('.currentline') as Line | undefined
            if (line) {
                generatePoints(line, pos)
            }
        })
        initRightClickMenu(
            this.stage,
            () => {
                this.tr.nodes([])
                this.#cleanAnchorShapes()
            },
            (s: Shape) => {
                const group = s.getParent() as Group
                group?.children
                    .find((c) => c.attrs.connectors)
                    ?.attrs.connectors.map((c: IConnector) => {
                        c.line.destroy()
                    })
                group?.destroy()
                this.#cleanAnchorShapes()
            },
            (s: Shape) => {
                const group = s.getParent() as Group
                this.#cleanAnchorShapes()
                this.tr.nodes([group])
                group.moveToTop()
            }
        )
    }

    /**
     * Initializes a menu with icons for the user to select from.
     */
    initToolboxMenu(conf: { container: string; iconSet: IPidIconSet }) {
        const menuEle = document.querySelector(conf.container)
        if (!menuEle) throw new Error(`Element with selector "${conf.container}" not found`)

        const menuContainer = document.createElement('div')
        menuContainer.className = 'cac-menu-container'
        document.body.appendChild(menuContainer)

        conf.iconSet.data.map((icon) => {
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
                this.addShape(icon, x, y)
                this.#fire()
            })

            menuContainer.appendChild(iconElement)
        })

        menuEle.addEventListener('click', () => {
            const isMenuVisible = menuContainer.style.display === 'block'
            menuContainer.style.display = isMenuVisible ? 'none' : 'block'
        })

        document.addEventListener('click', (event: any) => {
            if (!menuContainer.contains(event.target) && !menuEle.contains(event.target)) {
                menuContainer.style.display = 'none'
            }
        })
    }
}

// Make the line with 90 degres angles
const generatePoints = (line: Line, pos: Vector2d) => {
    const startX = line.points().at(0)!
    const startY = line.points().at(1)!
    const middleX = (startX + pos.x) / 2
    const points = [startX, startY, middleX, startY, middleX, pos.y, pos.x, pos.y]
    line.points(points)
    return points
}

// Adjust canvas size on window resize
window.addEventListener('resize', () => {
    const stage = stages[0]
    stage.width(window.innerWidth)
    stage.height(window.innerHeight)
    // TODO
    // go()
})

export const initRightClickMenu = (
    stage: Stage,
    onShowMenu: () => void,
    onDelete: (s: Shape) => void,
    onResize: (s: Shape) => void
) => {
    let currentShape: Shape | undefined
    const menuNode = document.createElement('div')
    menuNode.id = 'menu'
    menuNode.style.display = 'none'
    menuNode.style.position = 'absolute'
    menuNode.style.width = '160px'
    menuNode.style.backgroundColor = 'white'
    menuNode.style.boxShadow = '0 0 5px grey'
    menuNode.style.borderRadius = '3px'

    const resizeButton = document.createElement('button')
    resizeButton.textContent = 'Resize and Rotate'
    resizeButton.style.width = '100%'
    resizeButton.style.backgroundColor = 'white'
    resizeButton.style.border = 'none'
    resizeButton.style.margin = '0'
    resizeButton.style.padding = '10px'

    const deleteButton = document.createElement('button')
    deleteButton.textContent = 'Delete'
    deleteButton.style.width = '100%'
    deleteButton.style.backgroundColor = 'white'
    deleteButton.style.border = 'none'
    deleteButton.style.margin = '0'
    deleteButton.style.padding = '10px'

    resizeButton.addEventListener('mouseover', () => {
        resizeButton.style.backgroundColor = '#f3f4f7'
    })
    resizeButton.addEventListener('mouseout', () => {
        resizeButton.style.backgroundColor = 'white'
    })
    resizeButton.addEventListener('click', () => {
        onResize(currentShape!)
        menuNode.style.display = 'none'
    })

    deleteButton.addEventListener('mouseover', () => {
        deleteButton.style.backgroundColor = '#f3f4f7'
    })
    deleteButton.addEventListener('mouseout', () => {
        deleteButton.style.backgroundColor = 'white'
    })
    deleteButton.addEventListener('click', () => {
        onDelete(currentShape!)
        menuNode.style.display = 'none'
    })

    menuNode.appendChild(resizeButton)
    menuNode.appendChild(deleteButton)
    document.body.appendChild(menuNode)

    window.addEventListener('click', () => (menuNode.style.display = 'none'))

    stage.on('contextmenu dbltap', (e) => {
        onShowMenu()
        e.evt.preventDefault()
        if (e.target === stage) return
        currentShape = e.target as Shape
        menuNode.style.display = 'initial'
        const containerRect = stage.container().getBoundingClientRect()
        menuNode.style.top = containerRect.top + stage.getPointerPosition()!.y + 4 + 'px'
        menuNode.style.left = containerRect.left + stage.getPointerPosition()!.x + 4 + 'px'
    })
}

export const CAC_TIPS = [
    'You can add icons from the left menu',
    isTouchDevice ? 'Double tap icons to edit them' : 'Right click icons to edit them',
    'You can drag icons on the whiteboard',
    // 'Press Ctrl + Z to undo your last action',
]
