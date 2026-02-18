/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommentsList, type Comment } from '../CommentsList'
import { CommentForm } from '../CommentForm'
import { CommentCard } from '../CommentCard'
import { VoiceInput } from '../VoiceInput'

const mockComments: Comment[] = [
  {
    id: '1',
    timecodeSec: 15,
    text: 'Логотип синий',
    category: 'DESIGN',
    priority: 'MEDIUM',
    authorName: 'John Doe',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    timecodeSec: 45,
    text: 'Музыка громче',
    category: 'AUDIO',
    priority: 'HIGH',
    authorName: 'Jane Smith',
    createdAt: new Date('2024-01-02'),
  },
]

describe('Video UI Components', () => {
  describe('CommentsList', () => {
    it('should render comments list', () => {
      render(
        <CommentsList
          comments={mockComments}
          currentTime={0}
          onCommentClick={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      expect(screen.queryByText('Логотип синий')).not.toBeNull()
      expect(screen.queryByText('Музыка громче')).not.toBeNull()
    })

    it('should show empty state when no comments', () => {
      render(
        <CommentsList
          comments={[]}
          currentTime={0}
          onCommentClick={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      expect(screen.queryByText(/no comments/i)).not.toBeNull()
    })

    it('should highlight active comment', () => {
      const { container } = render(
        <CommentsList
          comments={mockComments}
          currentTime={15}
          onCommentClick={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      const activeCards = container.querySelectorAll('.border-blue-500')
      expect(activeCards.length).toBeGreaterThan(0)
    })

    it('should call onCommentClick when clicking comment', () => {
      const onCommentClick = vi.fn()
      render(
        <CommentsList
          comments={mockComments}
          currentTime={0}
          onCommentClick={onCommentClick}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      fireEvent.click(screen.getByText('Логотип синий'))

      expect(onCommentClick).toHaveBeenCalledWith(15)
    })

    it('should filter comments by category', () => {
      render(
        <CommentsList
          comments={mockComments}
          currentTime={0}
          onCommentClick={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      const categoryFilter = screen.getByRole('combobox')
      fireEvent.change(categoryFilter, { target: { value: 'DESIGN' } })

      expect(screen.queryByText('Логотип синий')).not.toBeNull()
      expect(screen.queryByText('Музыка громче')).toBeNull()
    })
  })

  describe('CommentForm', () => {
    it('should render form with timecode', () => {
      render(<CommentForm timecode={45} onSave={vi.fn()} onCancel={vi.fn()} />)

      expect(screen.queryByText(/0:45/)).not.toBeNull()
      expect(screen.queryByPlaceholderText(/add your comment/i)).not.toBeNull()
    })

    it('should call onSave with text', async () => {
      const onSave = vi.fn()
      render(<CommentForm timecode={45} onSave={onSave} onCancel={vi.fn()} />)

      const textarea = screen.getByPlaceholderText(/add your comment/i)
      fireEvent.change(textarea, { target: { value: 'Test comment' } })

      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      expect(onSave).toHaveBeenCalledWith({
        text: 'Test comment',
        timecodeSec: 45,
      })
    })

    it('should disable save button when text is empty', () => {
      render(<CommentForm timecode={45} onSave={vi.fn()} onCancel={vi.fn()} />)

      const saveButton = screen.getByRole('button', { name: /save/i })
      expect((saveButton as HTMLButtonElement).disabled).toBe(true)
    })

    it('should prefill text when editing', () => {
      render(
        <CommentForm
          timecode={45}
          existingComment={{ id: '1', text: 'Existing text' }}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />,
      )

      const textarea = screen.getByPlaceholderText(/add your comment/i)
      expect((textarea as HTMLTextAreaElement).value).toBe('Existing text')
    })

    it('should show loading state', () => {
      render(<CommentForm timecode={45} onSave={vi.fn()} onCancel={vi.fn()} isLoading />)

      const saveButton = screen.getByRole('button', { name: /save/i })
      expect((saveButton as HTMLButtonElement).disabled).toBe(true)
    })
  })

  describe('CommentCard', () => {
    const mockComment: Comment = {
      id: '1',
      timecodeSec: 15,
      text: 'Test comment',
      category: 'DESIGN',
      priority: 'HIGH',
      authorName: 'John Doe',
      createdAt: new Date('2024-01-01'),
    }

    it('should render comment data', () => {
      render(
        <CommentCard
          comment={mockComment}
          isActive={false}
          onClick={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      expect(screen.queryByText('Test comment')).not.toBeNull()
      expect(screen.queryByText(/0:15/)).not.toBeNull()
      expect(screen.queryByText('DESIGN')).not.toBeNull()
      expect(screen.queryByText('HIGH')).not.toBeNull()
      expect(screen.queryByText(/John Doe/)).not.toBeNull()
    })

    it('should highlight when active', () => {
      const { container } = render(
        <CommentCard
          comment={mockComment}
          isActive
          onClick={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      expect(container.firstChild).not.toBeNull()
      expect((container.firstChild as HTMLElement).className.includes('border-blue-500')).toBe(true)
    })

    it('should call onClick when clicking card', () => {
      const onClick = vi.fn()
      render(
        <CommentCard
          comment={mockComment}
          isActive={false}
          onClick={onClick}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      fireEvent.click(screen.getByText('Test comment'))
      expect(onClick).toHaveBeenCalled()
    })

    it('should show edit/delete actions', () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn()

      render(
        <CommentCard
          comment={mockComment}
          isActive={false}
          onClick={vi.fn()}
          onEdit={onEdit}
          onDelete={onDelete}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: /edit comment/i }))
      expect(onEdit).toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: /delete comment/i }))
      expect(onDelete).toHaveBeenCalled()
    })
  })

  describe('VoiceInput', () => {
    it('should render record button', () => {
      render(
        <VoiceInput
          transcript=""
          isRecording={false}
          isSupported
          onStartRecording={vi.fn()}
          onStopRecording={vi.fn()}
          onTranscriptChange={vi.fn()}
          onClear={vi.fn()}
        />,
      )

      expect(screen.queryByText('Hold to Record')).not.toBeNull()
    })

    it('should show recording state', () => {
      render(
        <VoiceInput
          transcript=""
          isRecording
          isSupported
          onStartRecording={vi.fn()}
          onStopRecording={vi.fn()}
          onTranscriptChange={vi.fn()}
          onClear={vi.fn()}
        />,
      )

      expect(screen.queryByText('Recording...')).not.toBeNull()
    })

    it('should display transcript', () => {
      render(
        <VoiceInput
          transcript="Test transcript"
          isRecording={false}
          isSupported
          onStartRecording={vi.fn()}
          onStopRecording={vi.fn()}
          onTranscriptChange={vi.fn()}
          onClear={vi.fn()}
        />,
      )

      expect(screen.queryByDisplayValue('Test transcript')).not.toBeNull()
    })

    it('should call onStartRecording on mousedown', () => {
      const onStartRecording = vi.fn()
      render(
        <VoiceInput
          transcript=""
          isRecording={false}
          isSupported
          onStartRecording={onStartRecording}
          onStopRecording={vi.fn()}
          onTranscriptChange={vi.fn()}
          onClear={vi.fn()}
        />,
      )

      fireEvent.mouseDown(screen.getByRole('button', { name: /hold to record/i }))
      expect(onStartRecording).toHaveBeenCalled()
    })

    it('should call onStopRecording on mouseup', () => {
      const onStopRecording = vi.fn()
      render(
        <VoiceInput
          transcript=""
          isRecording
          isSupported
          onStartRecording={vi.fn()}
          onStopRecording={onStopRecording}
          onTranscriptChange={vi.fn()}
          onClear={vi.fn()}
        />,
      )

      fireEvent.mouseUp(screen.getByRole('button', { name: /recording/i }))
      expect(onStopRecording).toHaveBeenCalled()
    })

    it('should show not supported message', () => {
      render(
        <VoiceInput
          transcript=""
          isRecording={false}
          isSupported={false}
          onStartRecording={vi.fn()}
          onStopRecording={vi.fn()}
          onTranscriptChange={vi.fn()}
          onClear={vi.fn()}
        />,
      )

      expect(screen.queryByText(/not supported/i)).not.toBeNull()
    })

    it('should clear transcript', () => {
      const onClear = vi.fn()
      render(
        <VoiceInput
          transcript="Test"
          isRecording={false}
          isSupported
          onStartRecording={vi.fn()}
          onStopRecording={vi.fn()}
          onTranscriptChange={vi.fn()}
          onClear={onClear}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: /clear transcript/i }))
      expect(onClear).toHaveBeenCalled()
    })
  })
})