'use client'

import { useState } from 'react'

interface ProjectAssistantProps {
  projectId: string
  drawings: Array<{
    id: string
    filename: string
    status: string
  }>
  onBillUpdated?: () => void
}

type Message = {
  role: 'user' | 'assistant'
  text: string
}

export default function ProjectAssistant({
  projectId,
  drawings,
  onBillUpdated,
}: ProjectAssistantProps) {
  const [selectedDrawingIds, setSelectedDrawingIds] = useState<string[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const toggleDrawing = (id: string) => {
    setSelectedDrawingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSend = async () => {
    const question = input.trim()
    if (!question) return

    const drawingIds = selectedDrawingIds.length
      ? selectedDrawingIds
      : drawings.map((d) => d.id)

    const userMsg: Message = { role: 'user', text: question }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, drawingIds, question }),
      })
      const data = await res.json().catch(() => ({}))
      const reply =
        data.reply ||
        'Assistant is currently limited to basic project summaries. (No external AI configured yet.)'

      setMessages((prev) => [...prev, { role: 'assistant', text: reply }])

      if (data.billUpdated && onBillUpdated) {
        onBillUpdated()
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text:
            'Something went wrong while talking to the assistant. Please try again.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
        <p className="text-xs text-gray-600 mb-2">
          Select which files the assistant should look at, then ask questions
          about the quantities or bill. The assistant uses the extracted
          materials already in this project.
        </p>
        <div className="max-h-32 overflow-y-auto space-y-1">
          {drawings.map((d) => (
            <label
              key={d.id}
              className="flex items-center gap-2 text-xs text-gray-700"
            >
              <input
                type="checkbox"
                className="h-3 w-3"
                checked={
                  selectedDrawingIds.length === 0 ||
                  selectedDrawingIds.includes(d.id)
                }
                onChange={() => toggleDrawing(d.id)}
              />
              <span className="truncate" title={d.filename}>
                {d.filename}
              </span>
              <span className="text-[10px] text-gray-400 ml-auto">
                {d.status}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 border border-gray-200 rounded-lg p-2 bg-white flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 text-xs">
          {messages.length === 0 ? (
            <p className="text-gray-400 text-xs">
              Ask things like:
              <br />
              – “Summarize total glass area per type”
              <br />
              – “Highlight any rows with missing dimensions or quantity”
            </p>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                className={`px-2 py-1 rounded-md max-w-full whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-blue-50 text-gray-900 self-end'
                    : 'bg-gray-100 text-gray-800 self-start'
                }`}
              >
                {m.text}
              </div>
            ))
          )}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
              <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Thinking…
            </div>
          )}
        </div>
        <div className="mt-2 flex items-end gap-2">
          <textarea
            rows={2}
            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
            placeholder="Ask a question about the quantities or bill…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (!loading) handleSend()
              }
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

