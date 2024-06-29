import type {
	EditorProps,
	Language,
	PrismEditor,
	InputCommandCallback,
	InputSelection,
	KeyCommandCallback,
	EditorEventMap,
} from "./types"
import { TokenStream, highlightTokens, languages, tokenizeText } from "./prism"
import { useLayoutEffect, useCallback, useMemo, memo } from "react"

/**
 * The core editor component of the library.
 * @param props Props to customize some of the appearance and behavior of the editor.
 */
const Editor = memo((props: EditorProps) => {
	let prevLines: string[] = []
	let lineCount = 0
	let lines: HTMLCollectionOf<HTMLDivElement>
	let activeLine: HTMLElement
	let language: string
	let activeLineNumber = 0
	let value = ""
	let prevVal: string
	let prevClass: string
	let focused = false
	let tokens: TokenStream = []
	let textarea: HTMLTextAreaElement
	let container: HTMLDivElement

	const getInputSelection = (): InputSelection =>
		textarea
			? [textarea.selectionStart, textarea.selectionEnd, textarea.selectionDirection]
			: [0, 0, "none"]

	const listeners: {
		[P in keyof EditorEventMap]?: Set<EditorEventMap[P]>
	} = {}

	const keyCommandMap: Record<string, KeyCommandCallback | null> = {
		Escape() {
			textarea.blur()
		},
	}

	const inputCommandMap: Record<string, InputCommandCallback | null> = {}

	const updateSelection = (force?: true) => {
		if (handleSelectionChange || force) {
			const selection = getInputSelection()
			const newLine =
				editor.lines![
					(activeLineNumber = numLines(value, 0, selection[selection[2] < "f" ? 0 : 1]))
				]

			if (newLine != activeLine) {
				activeLine?.classList.remove("active-line")
				newLine.classList.add("active-line")
				activeLine = newLine
			}
			updateClass()
			dispatchEvent("selectionChange", selection, value)
		}
	}

	// Safari focuses the textarea if you change its selection or value programmatically
	const focusRelatedTarget = () =>
		isWebKit &&
		!focused &&
		addTextareaListener(
			editor,
			"focus",
			e => {
				let relatedTarget = e.relatedTarget as HTMLElement
				if (relatedTarget) relatedTarget.focus()
				else (e.target as HTMLElement).blur()
			},
			{ once: true },
		)

	const dispatchEvent = <T extends keyof EditorEventMap>(
		name: T,
		...args: Parameters<EditorEventMap[T]>
	) => {
		// @ts-expect-error TS is wrong
		listeners[name]?.forEach(handler => handler(...args))
		// @ts-expect-error TS is wrong
		editor.props["on" + name[0].toUpperCase() + name.slice(1)]?.(...args, editor)
	}

	const updateClass = () => {
		let props = editor.props
		let [start, end] = getInputSelection()
		let newClass = `prism-code-editor language-${language}${
			props.lineNumbers == false ? "" : " show-line-numbers"
		} pce-${props.wordWrap ? "" : "no"}wrap${props.rtl ? " pce-rtl" : ""} pce-${
			start < end ? "has" : "no"
		}-selection${focused ? " pce-focus" : ""}${props.readOnly ? " pce-readonly" : ""}`
		if (newClass != prevClass) container.className = prevClass = newClass
	}

	const update = () => {
		value = textarea.value
		tokens = tokenizeText(value, languages[language] || {})
		dispatchEvent("tokenize", tokens, language, value)

		let newLines = highlightTokens(tokens).split("\n")
		let start = 0
		let end2 = lineCount
		let end1 = (lineCount = newLines.length)

		while (newLines[start] == prevLines[start] && start < end1) ++start
		while (end1 && newLines[--end1] == prevLines[--end2]);

		if (start == end1 && start == end2) lines[start + 1].innerHTML = newLines[start] + "\n"
		else {
			let insertStart = end2 < start ? end2 : start - 1
			let i = insertStart
			let newHTML = ""

			while (i < end1) newHTML += `<div class=pce-line aria-hidden=true>${newLines[++i]}\n</div>`
			for (i = end1 < start ? end1 : start - 1; i < end2; i++) lines[start + 1].remove()
			if (newHTML) lines[insertStart + 1].insertAdjacentHTML("afterend", newHTML)
			for (i = insertStart + 1; i < lineCount; ) lines[++i].setAttribute("data-line", i as any)
			container.style.setProperty("--number-width", Math.ceil(Math.log10(lineCount + 1)) + ".001ch")
		}

		dispatchEvent("update", value)
		updateSelection(true)
		if (handleSelectionChange) setTimeout(setTimeout, 0, () => (handleSelectionChange = true))

		prevLines = newLines
		handleSelectionChange = false
	}

	const editor = useMemo(
		() =>
			({
				inputCommandMap,
				keyCommandMap,
				extensions: {},
				get value() {
					return value
				},
				get focused() {
					return focused
				},
				get tokens() {
					return tokens
				},
				get activeLine() {
					return activeLineNumber
				},
				on: (name, listener) => {
					;(listeners[name] ||= new Set<any>()).add(listener)
					return () => {
						listeners[name]!.delete(listener)
					}
				},
				update,
				getSelection: getInputSelection,
				setSelection(start, end = start, direction) {
					focusRelatedTarget()
					textarea.setSelectionRange(start, end, direction)
					updateSelection(true)
				},
			} as PrismEditor),
		[],
	)

	// @ts-expect-error Allow assigning read-only property
	editor.props = props = Object.assign({ language: "text", value: "" }, props)

	useLayoutEffect(
		useCallback(() => {
			if (activeLine) return

			addTextareaListener(editor, "keydown", e => {
				keyCommandMap[e.key]?.(e, getInputSelection(), value) && preventDefault(e)
			})
			addTextareaListener(editor, "beforeinput", e => {
				if (
					editor.props.readOnly ||
					(e.inputType == "insertText" && inputCommandMap[e.data!]?.(e, getInputSelection(), value))
				)
					preventDefault(e)
			})
			addTextareaListener(editor, "input", update)
			addTextareaListener(editor, "blur", () => {
				selectionChange = null
				focused = false
				updateClass()
			})
			addTextareaListener(editor, "focus", () => {
				selectionChange = updateSelection
				focused = true
				updateClass()
			})
			// For browsers that support selectionchange on textareas
			addTextareaListener(editor, "selectionchange", e => {
				updateSelection()
				preventDefault(e)
			})
		}, []),
		[],
	)

	// Using useCallback here so the effect function uses variables from the first closure
	useLayoutEffect(
		useCallback(() => {
			const { value: newVal, language: newLang } = editor.props
			if (newVal != prevVal) {
				focusRelatedTarget()
				textarea.value = prevVal = newVal
				textarea.selectionEnd = 0
			}
			language = newLang
			update()
		}, []),
		[props.value, props.language],
	)

	useLayoutEffect(useCallback(updateClass, []))

	return (
		<div
			ref={useCallback((el: HTMLDivElement | null) => {
				if (el) editor.container = container = el
			}, [])}
			style={{
				...props.style,
				tabSize: props.tabSize || 2,
			}}
		>
			<div
				className="pce-wrapper"
				ref={useCallback((el: HTMLDivElement | null) => {
					if (el) {
						editor.wrapper = el
						editor.lines = lines = el.children as HTMLCollectionOf<HTMLDivElement>
					}
				}, [])}
			>
				<div className="pce-overlays">
					<textarea
						spellCheck={false}
						autoCapitalize="off"
						autoComplete="off"
						inputMode={props.readOnly ? "none" : "text"}
						aria-readonly={props.readOnly}
						{...props.textareaProps}
						ref={useCallback((el: HTMLTextAreaElement | null) => {
							if (el) {
								editor.textarea = textarea = el
							}
						}, [])}
					/>
					{props.children?.(editor)}
				</div>
			</div>
		</div>
	)
})

/** Object storing all language specific behavior. */
const languageMap: Record<string, Language> = {}

const preventDefault = (e: Event) => {
	e.preventDefault()
	e.stopImmediatePropagation()
}

const addTextareaListener = <T extends keyof HTMLElementEventMap>(
	editor: PrismEditor,
	type: T,
	listener: (this: HTMLTextAreaElement, ev: HTMLElementEventMap[T]) => any,
	options?: boolean | AddEventListenerOptions,
) => {
	editor.textarea?.addEventListener(type, listener, options)
	return () => editor.textarea?.removeEventListener(type, listener, options)
}

const userAgent = navigator.userAgent
const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.platform)
const isChrome = /Chrome\//.test(userAgent)
const isWebKit = !isChrome && /AppleWebKit\//.test(userAgent)

/**
 * Counts number of lines in the string between `start` and `end`.
 * If start and end are excluded, the whole string is searched.
 */
const numLines = (str: string, start = 0, end = Infinity) => {
	let count = 1
	for (; (start = str.indexOf("\n", start) + 1) && start <= end; count++);
	return count
}

document.addEventListener("selectionchange", () => selectionChange?.())

let selectionChange: null | (() => void)
let handleSelectionChange = true

export {
	Editor,
	addTextareaListener,
	preventDefault,
	languageMap,
	isMac,
	isChrome,
	isWebKit,
	numLines,
}
