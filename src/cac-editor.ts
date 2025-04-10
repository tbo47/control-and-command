import { Group } from 'konva-es/lib/Group'
import { Layer } from 'konva-es/lib/Layer'
import { Circle } from 'konva-es/lib/shapes/Circle'
import { Line, LineConfig } from 'konva-es/lib/shapes/Line'
import { Path } from 'konva-es/lib/shapes/Path'
import { Rect } from 'konva-es/lib/shapes/Rect'
import { Text } from 'konva-es/lib/shapes/Text'
import { Transformer } from 'konva-es/lib/shapes/Transformer'
import { Stage, StageConfig, stages } from 'konva-es/lib/Stage'
import { Vector2d } from 'konva-es/lib/types'

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

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

export const fetchPidIconSet = async () => {
    const response = await fetch(PID_DATASET_URL)
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
        radius: isTouchDevice ? 10 : 5,
        radiusOver: isTouchDevice ? 22 : 7,
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

    constructor() {
        this.stage = new Stage({
            container: 'app', // id of container <div>
            width: window.innerWidth,
            height: window.innerHeight - 40,
        })
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

    #createAnchorShapes(valve: IPidShape, icon: Path) {
        this.#cleanAnchorShapes()
        const { x, y } = icon.getClientRect({ relativeTo: this.layer })
        return valve.anchors.map((anchor, anchorIndex) => {
            const anchorShape = new Circle({
                x: anchor.x + x,
                y: anchor.y + y,
                radius: P.anchor.radius,
                fill: P.anchor.color,
                name: 'anchor',
            })
            anchorShape.on('mouseover touchover', () => anchorShape.radius(P.anchor.radiusOver))
            anchorShape.on('mouseout touchout', () => anchorShape.radius(P.anchor.radius))
            anchorShape.on('mouseup touchend', () => {
                const line = this.layer.findOne('.currentline') as Line | undefined
                if (line) {
                    const pos = anchorShape.absolutePosition()
                    generatePoints(line, pos)
                    line.name('connector')
                    this.#cleanAnchorShapes()
                    const anchorIndexStart = line.getAttr('anchorIndexStart') as number
                    // const pidStart = line.getAttr('pidShapeStart') as IPidShape
                    const shapeStart = line.getAttr('pathStart') as Path
                    this.#addConnectorToPath(icon, line, anchorIndex, 'end')
                    this.#addConnectorToPath(shapeStart, line, anchorIndexStart, 'start')
                }
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
                    newLine.setAttr('anchorIndexStart', anchorIndex)
                    newLine.setAttr('pidShapeStart', valve)
                    newLine.setAttr('pathStart', icon)
                    this.layer.add(newLine)
                }
            })
            this.layer.add(anchorShape)
            anchorShape.moveToTop()
            return anchorShape
        })
    }

    #addConnectorToPath(shape: Path, line: Line, anchorIndex: number, type: 'start' | 'end') {
        if (!shape.getAttr('connectors')) shape.setAttr('connectors', [])
        shape.getAttr('connectors').push({ line, anchorIndex, shape, type } as IConnector)
    }

    #cleanAnchorShapes() {
        this.layer.find('.anchor').map((shape) => shape.destroy())
    }

    addShape(valve: IPidShape, x: number, y: number) {
        const group = new Group({ x, y, draggable: true })
        const icon = new Path({ data: valve.path, name: valve.name, ...P.shapePathParams })
        group.on('click tap', () => {
            this.tr.nodes([])
            this.#createAnchorShapes(valve, icon)
        })
        group.add(icon)
        const text = new Text({ text: valve.name, ...P.textParams })
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
                this.#createAnchorShapes(valve, icon)
            } else {
                e.target.getStage()!.container().style.cursor = 'move'
            }
        })
        group.on('mousedown', () => this.#cleanAnchorShapes())
        group.on('dblclick dbltap', () => {
            this.#cleanAnchorShapes()
            this.tr.nodes([group])
            group.moveToTop()
        })
        group.on('mouseout touchout', (e) => {
            e.target.getStage()!.container().style.cursor = 'default'
        })
        group.on('dragmove', () => {
            const connectors = icon.getAttr('connectors') as IConnector[]
            if (!connectors) return
            connectors.forEach((c: IConnector) => {
                const g = group.absolutePosition()
                const anchor = valve.anchors[c.anchorIndex]
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
        this.layer.add(group)
        return group
    }

    init() {
        this.stage.on('click tap', (e) => {
            if (e.target === this.stage) {
                this.tr.nodes([])
                this.#cleanAnchorShapes()
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
