import { useLayoutEffect, useMemo, useRef } from "react"
import { PrismEditor } from "../types"
import { createTemplate } from "../utils/local"
import { useStableRef } from "../core"

/** Component adding indent guides to an editor. Does not work with word wrap. */
export const IndentGuides = ({ editor }: { editor: PrismEditor }) => {
	let prevLength = 0
	let lineIndentMap: number[]
	let active = -1

	const container = useRef<HTMLDivElement>(null)
	const lines: HTMLDivElement[] = []
	const indents: number[][] = []

	const update = (code: string) => {
		lineIndentMap = []
		const tabSize = editor.props.tabSize || 2
		const newIndents = getIndents(code.split("\n"), tabSize)
		const l = newIndents.length

		for (let i = 0, prev: number[] = [], next = newIndents[0]; next; i++) {
			const style = (lines[i] ||= guideTemplate()).style
			const [top, height, left] = next
			const old = indents[i]

			next = newIndents[i + 1]

			if (top != old?.[0]) style.top = top + "00%"
			if (height != old?.[1]) style.height = height + "00%"
			if (left != old?.[2]) style.left = left * 100 + "%"

			const isSingleIndent = prev[0] != top && next?.[0] != top,
				isSingleOutdent = prev[0] + prev[1] != top + height && next?.[0] + next?.[1] != top + height

			for (let j = -isSingleIndent, l = height + (isSingleOutdent as any); j < l; j++)
				lineIndentMap[j + top] = i

			prev = indents[i] = newIndents[i]
		}

		for (let i = prevLength; i > l; ) lines[--i].remove()
		container.current!.append(...lines.slice(prevLength, (prevLength = l)))
	}

	const updateActive = () => {
		const newActive = lineIndentMap[editor.activeLine - 1] ?? -1

		if (newActive != active) {
			active > -1 && (lines[active].className = "")
			newActive > -1 && (lines[newActive].className = "active")
		}
		active = newActive
	}

	const props = editor.props
	const noWrap = !props.wordWrap

	useLayoutEffect(
		useStableRef(() => {
			const value = editor.value
			const cleanup1 = editor.on("update", update)
			const cleanup2 = editor.on("selectionChange", updateActive)

			if (value) {
				update(value)
				updateActive()
			}

			return () => {
				cleanup1()
				cleanup2()
			}
		}),
		[props.tabSize],
	)

	return useMemo(() => {
		return (
			<div
				ref={container}
				className="guide-indents"
				style={{
					left: "var(--padding-left)",
					bottom: "auto",
					right: "auto",
					display: noWrap ? "" : "none",
				}}
			>
				{" "}
			</div>
		)
	}, [noWrap])
}

const getIndents = (lines: string[], tabSize: number) => {
	const l = lines.length
	const stack: number[][] = []
	const results: number[][] = []

	for (let prevIndent = 0, emptyPos = -1, i = 0, p = 0; ; i++) {
		const last = i == l
		const indent = last ? 0 : getIndentCount(lines[i], tabSize)
		if (indent < 0) {
			if (emptyPos < 0) emptyPos = i
		} else {
			for (let j = indent; j < prevIndent; j++) {
				// Updating height of the closed lines
				stack[j][1] = (emptyPos < 0 || (j == indent && !last) ? i : emptyPos) - stack[j][0]
			}
			for (let j = prevIndent; j < indent; ) {
				// Adding new indentation lines
				results[p++] = stack[j] = [emptyPos < 0 || j > prevIndent ? i : emptyPos, 0, j++ * tabSize]
			}
			emptyPos = -1
			prevIndent = indent
		}
		if (last) break
	}

	return results
}

const getIndentCount = (text: string, tabSize: number) => {
	let l = text.search(/\S/)
	let result = 0
	if (l < 0) return l
	for (let i = 0; i < l; ) {
		result += text[i++] == "\t" ? tabSize - (result % tabSize) : 1
	}
	return Math.ceil(result / tabSize)
}

const guideTemplate = createTemplate(
	"<div style=width:1px;position:absolute;background:var(--bg-guide-indent)>",
)
