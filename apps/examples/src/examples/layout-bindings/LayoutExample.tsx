import {
	BindingOnCreateOptions,
	BindingOnShapeChangeOptions,
	BindingUtil,
	HTMLContainer,
	RecordProps,
	Rectangle2d,
	ShapeUtil,
	T,
	TLBaseBinding,
	TLBaseShape,
	TLShape,
	Tldraw,
	createBindingId,
} from 'tldraw'
import snapShot from './snapshot.json'

// eslint-disable-next-line @typescript-eslint/ban-types
type ElementShape = TLBaseShape<'element', { color: string }>
// eslint-disable-next-line @typescript-eslint/ban-types
type ContainerShape = TLBaseShape<'element', { height: number; width: number }>

class ElementShapeUtil extends ShapeUtil<ElementShape> {
	static override type = 'element' as const
	static override props: RecordProps<ElementShape> = {
		color: T.string,
	}

	override getDefaultProps() {
		return {
			color: '#AEC6CF',
		}
	}

	override canBind({
		fromShapeType,
		toShapeType,
		bindingType,
	}: {
		fromShapeType: string
		toShapeType: string
		bindingType: string
	}) {
		return fromShapeType === 'container' && toShapeType === 'element' && bindingType === 'layout'
	}
	override canEdit = () => false
	override canResize = () => false
	override hideRotateHandle = () => true
	override isAspectRatioLocked = () => true

	override getGeometry() {
		return new Rectangle2d({
			width: 100,
			height: 100,
			isFilled: true,
		})
	}

	override component(shape: ElementShape) {
		return <HTMLContainer style={{ backgroundColor: shape.props.color }}></HTMLContainer>
	}

	override indicator() {
		return <rect width={100} height={100} />
	}

	override onTranslateStart = (element: ElementShape) => {
		const binding = this.editor.getBindingsToShape(element, 'layout')[0] as LayoutBinding

		if (!binding) return
		this.editor.deleteBinding(binding)
		const layoutBindingUtil = this.editor.getBindingUtil('layout') as LayoutBindingUtil
		layoutBindingUtil.reShuffleAnchors(binding)
		layoutBindingUtil.updateContainerWidth(binding)
	}

	override onTranslateEnd = (initial: ElementShape, element: ElementShape) => {
		const bindings = this.editor.getBindingsToShape(element, 'layout') as LayoutBinding[]
		const bindingExists = bindings.length > 0
		if (bindingExists) return
		const pageAnchor = this.editor.getShapePageTransform(element).applyToPoint({ x: 50, y: 50 })
		const target = this.editor.getShapeAtPoint(pageAnchor, {
			hitInside: true,
			filter: (shape) =>
				this.editor.canBindShapes({ fromShape: shape, toShape: element, binding: 'layout' }),
		})

		if (!target) return
		const elementCount = this.editor.getBindingsFromShape(target, 'layout').length + 1
		const bindingId = createBindingId()

		const atEnd = pageAnchor.x > target.x + (elementCount - 1) * 100

		// first element, or at the end
		if (elementCount === 0 || atEnd) {
			this.editor.createBinding({
				id: bindingId,
				type: 'layout',
				fromId: target.id,
				toId: element.id,
				props: {
					anchor: elementCount,
				},
			})
		} else {
			// find which two elements to insert between, and shuffle the anchors
			const atStart = pageAnchor.x < target.x + 100
			const afterFirstElement = pageAnchor.x > target.x + 100 && pageAnchor.x < target.x + 200
			const afterSecondElement = pageAnchor.x > target.x + 200 && pageAnchor.x < target.x + 300

			const anchor = atStart ? 1 : afterFirstElement ? 2 : afterSecondElement ? 3 : 4

			this.editor.createBinding({
				id: bindingId,
				type: 'layout',
				fromId: target.id,
				toId: element.id,
				props: {
					anchor: anchor,
				},
			})
		}

		const layoutBindingUtil = this.editor.getBindingUtil('layout') as LayoutBindingUtil
		const binding = this.editor.getBinding(bindingId) as LayoutBinding

		layoutBindingUtil.reShuffleAnchors(binding)
		const bindingsFrom = this.editor.getBindingsFromShape(target, 'layout') as LayoutBinding[]
		for (const currentBinding of bindingsFrom) {
			layoutBindingUtil.moveElementToAnchor(currentBinding, target)
		}
	}
}

const PADDING = 24
class ContainerShapeUtil extends ShapeUtil<ContainerShape> {
	static override type = 'container' as const
	static override props: RecordProps<ContainerShape> = { height: T.number, width: T.number }

	override getDefaultProps() {
		return {
			width: 100 + PADDING * 2,
			height: 100 + PADDING * 2,
		}
	}

	override canBind({
		fromShapeType,
		toShapeType,
		bindingType,
	}: {
		fromShapeType: string
		toShapeType: string
		bindingType: string
	}) {
		return fromShapeType === 'container' && toShapeType === 'element' && bindingType === 'layout'
	}
	override canEdit = () => false
	override canResize = () => false
	override hideRotateHandle = () => true
	override isAspectRatioLocked = () => true

	override getGeometry(shape: ContainerShape) {
		return new Rectangle2d({
			width: shape.props.width,
			height: shape.props.height,
			isFilled: true,
		})
	}

	override component(shape: ContainerShape) {
		return (
			<HTMLContainer
				style={{
					backgroundColor: '#efefef',
					width: shape.props.width,
					textAlign: 'center',
					padding: 8,
				}}
			>
				Container
			</HTMLContainer>
		)
	}

	override indicator(shape: ContainerShape) {
		return <rect width={shape.props.width} height={shape.props.height} />
	}
}

type LayoutBinding = TLBaseBinding<
	'layout',
	{
		anchor: number
	}
>
class LayoutBindingUtil extends BindingUtil<LayoutBinding> {
	static override type = 'layout' as const

	override getDefaultProps() {
		return {
			anchor: 1,
		}
	}

	override onAfterCreate(options: BindingOnCreateOptions<LayoutBinding>): void {
		this.updateContainerWidth(options.binding)
	}

	override onAfterChangeFromShape({
		binding,
		shapeAfter,
	}: BindingOnShapeChangeOptions<LayoutBinding>): void {
		this.moveElementToAnchor(binding, shapeAfter)
	}

	reShuffleAnchors(binding: LayoutBinding) {
		const bindings = this.editor.getBindingsFromShape(binding.fromId, 'layout') as LayoutBinding[]
		if (bindings.length === 0) return

		const sorted = bindings.sort((a, b) => {
			if (a.props.anchor === b.props.anchor) return -1
			return a.props.anchor - b.props.anchor
		})

		for (let i = 0; i < sorted.length; i++) {
			this.editor.updateBinding({
				...sorted[i],
				props: {
					...sorted[i].props,
					anchor: i + 1,
				},
			})
		}
	}

	moveElementToAnchor(binding: LayoutBinding, shapeAfter: TLShape) {
		const element = this.editor.getShape<ElementShape>(binding.toId)!
		const containerBounds = this.editor.getShapeGeometry(binding.fromId).bounds
		const pageAnchor = this.editor.getShapePageTransform(shapeAfter).applyToPoint({
			x: containerBounds.x + PADDING * binding.props.anchor + 100 * (binding.props.anchor - 1),
			y: containerBounds.y + PADDING,
		})

		this.editor.updateShape({
			id: element.id,
			type: 'element',
			x: pageAnchor.x,
			y: pageAnchor.y,
		})
	}

	updateContainerWidth(binding: LayoutBinding) {
		const container = this.editor.getShape<ContainerShape>(binding.fromId)!
		const bindings = this.editor.getBindingsFromShape(container, 'layout') as LayoutBinding[]
		const numberOfElements = Math.max(bindings.length, 1)

		const next = {
			...container,
			props: {
				...container.props,
				width: numberOfElements * 100 + PADDING * (numberOfElements + 1),
			},
		}
		this.editor.updateShape(next)
	}
}

export default function LayoutExample() {
	return (
		<div className="tldraw__editor">
			<Tldraw
				// @ts-ignore
				snapshot={snapShot}
				onMount={(editor) => {
					;(window as any).editor = editor
				}}
				shapeUtils={[ContainerShapeUtil, ElementShapeUtil]}
				bindingUtils={[LayoutBindingUtil]}
			/>
		</div>
	)
}
