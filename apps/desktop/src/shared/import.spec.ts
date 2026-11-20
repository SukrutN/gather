import { describe, expect, it } from 'vitest'
import { importManuscript } from './import'

describe('importManuscript', () => {
  it('splits a heading-structured manuscript into chapters and scenes', () => {
    const text = [
      '# Chapter One',
      'The lamps counted fourteen.',
      '## Keys',
      'She locked the street door.',
      '## The Drawer',
      'The drawer said 12:00.',
      '# Chapter Two',
      'The morning clerk arrived.',
    ].join('\n')
    const result = importManuscript(text)
    expect(result.chapters).toHaveLength(2)
    expect(result.chapters[0]?.title).toBe('Chapter One')
    expect(result.chapters[0]?.body).toBe('The lamps counted fourteen.')
    expect(result.chapters[0]?.scenes).toHaveLength(2)
    expect(result.chapters[0]?.scenes[0]?.title).toBe('Keys')
    expect(result.chapters[0]?.scenes[0]?.body).toBe('She locked the street door.')
    expect(result.chapters[1]?.title).toBe('Chapter Two')
    expect(result.chapters[1]?.body).toBe('The morning clerk arrived.')
    expect(result.chapters[1]?.scenes).toHaveLength(0)
  })

  it('keeps text before the first heading as an opening chapter', () => {
    const text = ['A cold open on the pier.', '# Chapter One', 'Then it begins.'].join('\n')
    const result = importManuscript(text)
    expect(result.chapters).toHaveLength(2)
    expect(result.chapters[0]?.title).toBe('Opening')
    expect(result.chapters[0]?.body).toBe('A cold open on the pier.')
    expect(result.chapters[1]?.title).toBe('Chapter One')
  })

  it('gives a scene before any chapter an Opening chapter', () => {
    const text = ['## Prologue', 'A scene with no chapter around it.'].join('\n')
    const result = importManuscript(text)
    expect(result.chapters).toHaveLength(1)
    expect(result.chapters[0]?.title).toBe('Opening')
    expect(result.chapters[0]?.scenes).toHaveLength(1)
    expect(result.chapters[0]?.scenes[0]?.title).toBe('Prologue')
    expect(result.chapters[0]?.scenes[0]?.body).toBe('A scene with no chapter around it.')
  })

  it('drops heading husks with no content', () => {
    const text = ['# Empty Chapter', '# Full Chapter', 'Something happens.'].join('\n')
    const result = importManuscript(text)
    expect(result.chapters).toHaveLength(1)
    expect(result.chapters[0]?.title).toBe('Full Chapter')
  })

  it('splits a heading-free file into scenes on blank gaps', () => {
    const text = ['First beat.', '', '', 'Second beat.', '', '', 'Third beat.'].join('\n')
    const result = importManuscript(text)
    expect(result.chapters).toHaveLength(1)
    expect(result.chapters[0]?.title).toBe('Imported manuscript')
    expect(result.chapters[0]?.scenes).toHaveLength(3)
    expect(result.chapters[0]?.scenes[1]?.body).toBe('Second beat.')
    expect(result.chapters[0]?.scenes[1]?.title).toBe('Scene 2')
  })

  it('handles a single uninterrupted block', () => {
    const result = importManuscript('One paragraph, no breaks at all.')
    expect(result.chapters).toHaveLength(1)
    expect(result.chapters[0]?.scenes).toHaveLength(1)
    expect(result.chapters[0]?.scenes[0]?.body).toBe('One paragraph, no breaks at all.')
  })

  it('normalizes CRLF and a BOM before parsing', () => {
    const text = `\uFEFF# Chapter One\r\n\r\nWritten on another machine.\r\n`
    const result = importManuscript(text)
    expect(result.chapters[0]?.body).toBe('Written on another machine.')
  })

  it('returns nothing for empty input', () => {
    expect(importManuscript('')).toEqual({ chapters: [] })
    expect(importManuscript('   \n\n  ')).toEqual({ chapters: [] })
  })

  it('numbers untitled headings', () => {
    const text = ['#', 'First.', '#', 'Second.'].join('\n')
    const result = importManuscript(text)
    expect(result.chapters.map((chapter) => chapter.title)).toEqual(['Chapter 1', 'Chapter 2'])
  })
})
