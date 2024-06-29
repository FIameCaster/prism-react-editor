import { useLayoutEffect } from "react";
import { InputSelection, PrismEditor } from "../types";
import { getLineBefore } from "../utils";
import { getLineEnd, scrollToEl } from "../utils/local";
import { addTextareaListener } from "../core";
import { createTemplate } from "../utils/local";
import { useDefaultCommands } from "./commands";

/** Postion of the cursor relative to the editors overlays. */
export type CursorPosition = {
	top: number
	bottom: number
	left: number
	right: number
	height: number
}

export interface Cursor {
	/** Gets the cursor position relative to the editor's overlays. */
	getPosition(): CursorPosition
	/** Scrolls the cursor into view. */
	scrollIntoView(): void
}

const cursorTemplate = createTemplate(
	'<div style=position:absolute;top:0;opacity:0;padding:inherit> <span><span></span> ',
)
/**
 * Hook making it easier to calculate the position of the cursor and scroll it into view.
 * This is used by {@link useDefaultCommands} to keep the cursor in view while typing.
 * 
 * The extension can be accessed from `editor.extensions.cursor` after layout effects
 * have been run.
 */
export const useCursorPosition = (editor: PrismEditor) => {
	useLayoutEffect(() => {
		let prevBefore = " "
		let prevAfter = " "

		const cursorContainer = cursorTemplate()
		const [before, span] = <[Text, HTMLSpanElement]>(<unknown>cursorContainer.childNodes)
		const [cursor, after] = <[HTMLSpanElement, Text]>(<unknown>span.childNodes)
		const selectionChange = (selection: InputSelection) => {
			let value = editor.value
			let activeLine = editor.lines![editor.activeLine]
			let position = selection[selection[2] < "f" ? 0 : 1]
			let newBefore = getLineBefore(value, position)
			let newAfter = value.slice(position, getLineEnd(value, position))

			if (!newBefore && !newAfter) newAfter = "\n"
			if (prevBefore != newBefore) before.data = prevBefore = newBefore
			if (prevAfter != newAfter) after.data = prevAfter = newAfter
			if (cursorContainer.parentNode != activeLine) activeLine.prepend(cursorContainer)
		}
		const scrollIntoView = () => scrollToEl(editor, cursor)

		const cleanup1 = editor.on("selectionChange", selectionChange)
		const cleanup2 = addTextareaListener(editor, "input", e => {
			if (/history/.test((<InputEvent>e).inputType)) scrollIntoView()
		})

		editor.extensions.cursor = {
			scrollIntoView,
			getPosition() {
				const rect1 = cursor.getBoundingClientRect()
				const rect2 = editor.lines![0].getBoundingClientRect()
	
				return {
					top: rect1.y - rect2.y,
					bottom: rect2.bottom - rect1.bottom,
					left: rect1.x - rect2.x,
					right: rect2.right - rect1.x,
					height: rect1.height,
				}
			},
		}

		return () => {
			delete editor.extensions.cursor
			cleanup1()
			cleanup2()
			cursor.remove()
		}
	}, [])

}
