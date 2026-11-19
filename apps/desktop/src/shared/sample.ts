import type { BinderNode, Doc, Project } from './types'

const id = {
  manuscript: '6f0c2a10-1b2c-4d3e-8f01-000000000001',
  part1: '6f0c2a10-1b2c-4d3e-8f01-000000000002',
  chapter1: '6f0c2a10-1b2c-4d3e-8f01-000000000003',
  keys: '6f0c2a10-1b2c-4d3e-8f01-000000000004',
  drawer: '6f0c2a10-1b2c-4d3e-8f01-000000000005',
  chapter2: '6f0c2a10-1b2c-4d3e-8f01-000000000006',
  hour: '6f0c2a10-1b2c-4d3e-8f01-000000000007',
  part2: '6f0c2a10-1b2c-4d3e-8f01-000000000008',
  chapter3: '6f0c2a10-1b2c-4d3e-8f01-000000000009',
  slip: '6f0c2a10-1b2c-4d3e-8f01-00000000000a',
  characters: '6f0c2a10-1b2c-4d3e-8f01-000000000010',
  leah: '6f0c2a10-1b2c-4d3e-8f01-000000000011',
  adel: '6f0c2a10-1b2c-4d3e-8f01-000000000012',
  places: '6f0c2a10-1b2c-4d3e-8f01-000000000020',
  library: '6f0c2a10-1b2c-4d3e-8f01-000000000021',
  hours: '6f0c2a10-1b2c-4d3e-8f01-000000000022',
  notes: '6f0c2a10-1b2c-4d3e-8f01-000000000030',
  rules: '6f0c2a10-1b2c-4d3e-8f01-000000000031',
} as const

function doc(partial: Pick<Doc, 'id' | 'kind' | 'title' | 'status'> & Partial<Doc>): Doc {
  return {
    synopsis: '',
    body: '',
    role: '',
    placeType: '',
    summary: '',
    pov: '',
    location: '',
    thread: '',
    storyDay: '',
    wordGoal: 0,
    goal: '',
    fear: '',
    secret: '',
    sense: '',
    control: '',
    relationships: [],
    extra: [],
    ...partial,
  }
}

function node(idValue: string, kind: BinderNode['kind'], title: string, children?: BinderNode[]): BinderNode {
  return children ? { id: idValue, kind, title, children } : { id: idValue, kind, title }
}

export function createSample(): { project: Project; docs: Record<string, Doc> } {
  const stamp = '2026-01-08T00:40:00.000Z'
  const project: Project = {
    format: 'gather-project',
    version: 1,
    title: 'The Keep of Small Hours',
    author: '',
    wordGoal: 0,
    threads: [],
    created: stamp,
    modified: stamp,
    binder: [
      node(id.manuscript, 'manuscript', 'Manuscript', [
        node(id.part1, 'part', 'The Night Stack', [
          node(id.chapter1, 'chapter', 'After Close', [
            node(id.keys, 'scene', 'Keys'),
            node(id.drawer, 'scene', 'The Drawer'),
          ]),
          node(id.chapter2, 'chapter', 'Borrowed Time', [node(id.hour, 'scene', 'One Slipped Hour')]),
        ]),
        node(id.part2, 'part', 'What Morning Keeps', [
          node(id.chapter3, 'chapter', 'Returned', [node(id.slip, 'scene', 'The Slip')]),
        ]),
      ]),
      node(id.characters, 'characters', 'Characters', [
        node(id.leah, 'character', 'Leah Voss'),
        node(id.adel, 'character', 'M. Adel'),
      ]),
      node(id.places, 'places', 'Places', [
        node(id.library, 'place', 'Pier Street Library'),
        node(id.hours, 'place', 'The Hours Drawer'),
      ]),
      node(id.notes, 'notes', 'Notes', [node(id.rules, 'note', 'Rules for the slipped hour')]),
    ],
  }

  const docs: Record<string, Doc> = {
    [id.part1]: doc({
      id: id.part1,
      kind: 'part',
      title: 'The Night Stack',
      status: 'draft',
      synopsis: 'The library after the street door is locked.',
    }),
    [id.chapter1]: doc({
      id: id.chapter1,
      kind: 'chapter',
      title: 'After Close',
      status: 'revised',
      synopsis: 'Leah’s shift begins when the public one ends.',
    }),
    [id.keys]: doc({
      id: id.keys,
      kind: 'scene',
      title: 'Keys',
      status: 'revised',
      synopsis: 'Leah locks the street door and finds the evening clerk’s note.',
      body: `Leah Voss locked the street door at ten, and the building waited to see if she meant it. Pier Street still had traffic. Inside, the lamps over the newspapers dropped to their night setting, a yellower light that made the headlines look already historical.

She hung her coat on the back of the office chair. The chair knew the difference between a short shift and a long one and complained only on the long ones. Tonight would be long. The returns bin had been left in a state of optimism by the evening clerk: two shelves, alphabetized, and a note that said only “Adel came back.”

Leah read the note twice. Mr. Adel returned books no one had checked out. He was polite about it. He wrote his name on the slip as if politeness could invent a loan.`,
    }),
    [id.drawer]: doc({
      id: id.drawer,
      kind: 'scene',
      title: 'The Drawer',
      status: 'draft',
      synopsis: 'A catalog drawer is labeled with hours instead of letters.',
      body: `The card catalog had been kept for school groups and for people who distrusted the computers. Most of the drawers said A–Am, Am–Az, and so on, in a hand that had not been young for a long time. The bottom drawer on the left said 12:00–1:00.

Leah had asked about it her first month and been told it was a joke from a previous clerk. The drawer did not open for a joke. It opened for her, on nights when the note was waiting, and the cards inside were not titles. They were times. 12:10. 12:25. 12:40, written darker than the rest, as if someone had gone back over it.

She did not take a card. She closed the drawer with both hands, the way you close a piano when you are not sure the room is empty.`,
    }),
    [id.chapter2]: doc({
      id: id.chapter2,
      kind: 'chapter',
      title: 'Borrowed Time',
      status: 'draft',
      synopsis: 'An hour can be checked out, if you are willing to bring it back.',
    }),
    [id.hour]: doc({
      id: id.hour,
      kind: 'scene',
      title: 'One Slipped Hour',
      status: 'draft',
      synopsis: 'Leah checks out 12:40 a.m. and has until morning to bring it back.',
      body: `On Thursday she took the card. The slip she wrote was ordinary: name, date, and the title she invented because the system required one. She called it “A Short Geography of the Hour Between.” The computer accepted this without comment. The card catalog, which had opinions, did not.

12:40 lasted forty minutes. She spent them at the table by the atlas stand, reading nothing, listening to the building settle. When the minute hand let go, the newspapers were still today’s. She put the card back before the morning clerk’s key touched the lock. The drawer shut like a mouth that had decided not to speak.`,
    }),
    [id.part2]: doc({
      id: id.part2,
      kind: 'part',
      title: 'What Morning Keeps',
      status: 'idea',
      synopsis: 'The day shift inherits whatever the night failed to return.',
    }),
    [id.chapter3]: doc({
      id: id.chapter3,
      kind: 'chapter',
      title: 'Returned',
      status: 'idea',
      synopsis: 'Someone else has already signed for Leah’s invented book.',
    }),
    [id.slip]: doc({
      id: id.slip,
      kind: 'scene',
      title: 'The Slip',
      status: 'idea',
      synopsis: 'Mr. Adel has already signed for a book that was never lent.',
      body: `By the time Leah came in on Friday evening, the slip was in the bin. M. Adel, in the left-leaning hand, and tomorrow’s date. The title was hers: “A Short Geography of the Hour Between.” No one at the desk remembered typing it. The evening clerk had underlined the date and written, in the margin, “He said you would know.”

Leah did know, and she wished she knew less. She went to the catalog and stood with her hand on the drawer and did not pull. Somewhere under the newspapers, a lamp clicked. She counted the rest of them. Fourteen. The one over the atlas stand was already lit.`,
    }),
    [id.leah]: doc({
      id: id.leah,
      kind: 'character',
      title: 'Leah Voss',
      status: 'revised',
      role: 'Night librarian',
      summary: 'Keeps the Pier Street library between close and open, and has started to suspect the catalog is keeping her.',
      body: 'She counts the lamps when she is nervous. There are fourteen. She will not say which one belongs to the hours. She drinks tea she forgets to finish and leaves the bag in the cup, which the morning clerk has stopped mentioning.',
    }),
    [id.adel]: doc({
      id: id.adel,
      kind: 'character',
      title: 'M. Adel',
      status: 'draft',
      role: 'Patron',
      summary: 'Returns books that were never lent, always before open, never with an explanation that survives a second question.',
      body: 'Handwriting leans left. He signs the slip M. Adel and dates it tomorrow. He is never in the reading room when the lamps are up. The evening clerk has seen him only from the stairs.',
    }),
    [id.library]: doc({
      id: id.library,
      kind: 'place',
      title: 'Pier Street Library',
      status: 'done',
      placeType: 'Civic building',
      summary: 'A brick library at the end of Pier Street, too large for the town and too loved to close.',
      body: 'The night entrance is the staff door under the fire escape. The street door sticks in damp weather. The atlas stand is oak and has a wobble Leah has decided not to report, because a repair would move it, and she is not sure the drawer would approve.',
    }),
    [id.hours]: doc({
      id: id.hours,
      kind: 'place',
      title: 'The Hours Drawer',
      status: 'idea',
      placeType: 'Catalog drawer',
      summary: 'A card drawer labeled with times instead of letters. It should not open. It does, for Leah.',
      body: 'Bottom row, left side. The label is typed, not handwritten. The cards are times. Only 12:40 is inked twice. It smells faintly of graphite and of the inside of a coat pocket.',
    }),
    [id.rules]: doc({
      id: id.rules,
      kind: 'note',
      title: 'Rules for the slipped hour',
      status: 'draft',
      synopsis: 'Continuity notes for the draft.',
      body: 'The hour Leah can borrow is always 12:40 a.m. It lasts forty minutes. It must be back in the drawer before the morning clerk unlocks the street door. If she is late, the newspapers are already a day ahead. Adel dates his slips tomorrow, never today. Do not explain the drawer in the first chapter. Let the label do it.',
    }),
  }

  return { project, docs }
}
