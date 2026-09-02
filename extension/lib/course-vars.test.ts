import { describe, expect, it } from 'vitest'
import { courseVars, needsCourse, rupees } from './course-vars'
import { renderSnippet } from './snippet'
import type { CourseItem } from './contracts'

const course: CourseItem = {
  id: 'item-1',
  name: 'Full Stack Bootcamp',
  category: 'course',
  active: true,
  sales_facts: {
    fee: 85000,
    emi_monthly: 7100,
    emi_months: 12,
    duration: '6 months',
    batch_start: '2026-10-15',
    usp: 'Placement support until you land the job',
    proof: '312 alumni placed last year',
  },
}

describe('rupees', () => {
  it('formats with the Indian grouping and no paise', () => {
    expect(rupees(85000)).toBe('₹85,000')
    expect(rupees('7100')).toBe('₹7,100')
  })
  it('is null for anything that is not a number', () => {
    expect(rupees('call us')).toBeNull()
    expect(rupees(undefined)).toBeNull()
  })
})

describe('courseVars', () => {
  it('maps the seeded facts', () => {
    const vars = courseVars(course)
    expect(vars['course.name']).toBe('Full Stack Bootcamp')
    expect(vars['course.fee']).toBe('₹85,000')
    expect(vars['course.emi']).toBe('₹7,100')
    expect(vars['course.emi_months']).toBe('12')
    expect(vars['course.duration']).toBe('6 months')
    expect(vars['course.batch_start']).toMatch(/Oct/)
    expect(vars['course.proof']).toContain('312')
  })

  // The whole point: an absent fact must leave its token visible.
  it('omits missing keys so renderSnippet keeps the token on screen', () => {
    const vars = courseVars({ ...course, sales_facts: { fee: 85000 } })
    expect('course.emi' in vars).toBe(false)
    expect(renderSnippet('Fee {{course.fee}}, EMI {{course.emi}}', vars))
      .toBe('Fee ₹85,000, EMI {{course.emi}}')
  })

  it('omits everything when no course is picked', () => {
    expect(courseVars(null)).toEqual({})
    expect(renderSnippet('Fee {{course.fee}}', courseVars(null))).toBe('Fee {{course.fee}}')
  })

  it('ignores a batch_start that is not a date', () => {
    expect(courseVars({ ...course, sales_facts: { batch_start: 'soon' } })['course.batch_start']).toBeUndefined()
  })
})

describe('needsCourse', () => {
  it('spots a course token, whatever the spacing', () => {
    expect(needsCourse('Fee is {{course.fee}}')).toBe(true)
    expect(needsCourse('Fee is {{ course.fee }}')).toBe(true)
    expect(needsCourse('Hi {{name}}')).toBe(false)
  })
})
