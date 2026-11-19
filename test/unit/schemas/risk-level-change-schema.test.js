import {
  toFormValues,
  validateRiskLevelChange
} from '#/schemas/risk-level-change-schema.js'
import {
  currentRiskLevels,
  validFormPayload,
  validRiskLevelChange
} from '#test/helpers/risk-level-fixtures.js'

const errorsFor = (overrides, diseases = currentRiskLevels()) =>
  validateRiskLevelChange({ ...validFormPayload(), ...overrides }, diseases)
    .errors

describe('#validateRiskLevelChange', () => {
  test('Should return the risk level change for a valid payload', () => {
    const { value, errors } = validateRiskLevelChange(
      validFormPayload(),
      currentRiskLevels()
    )

    expect(errors).toBeUndefined()
    expect(value).toEqual(validRiskLevelChange())
  })

  test('Should trim each comment and drop fields that are not part of the form', () => {
    const { value } = validateRiskLevelChange(
      {
        ...validFormPayload(),
        'userComment-asf': '  New outbreaks reported in domestic pigs.  ',
        crumb: 'token'
      },
      currentRiskLevels()
    )

    expect(value).toEqual(validRiskLevelChange())
    expect(value).not.toHaveProperty('crumb')
  })

  test('Should return the errors for each disease in form order, direction before comment, when the payload is empty', () => {
    const { errors } = validateRiskLevelChange({}, currentRiskLevels())

    expect(Object.entries(errors)).toEqual([
      [
        'direction-asf',
        'Select whether the risk level for African swine fever increases, decreases or stays the same'
      ],
      ['userComment-asf', 'Enter a comment for African swine fever'],
      [
        'direction-hpai',
        'Select whether the risk level for Highly pathogenic avian influenza increases, decreases or stays the same'
      ],
      [
        'userComment-hpai',
        'Enter a comment for Highly pathogenic avian influenza'
      ],
      [
        'direction-bluetongue',
        'Select whether the risk level for Bluetongue increases, decreases or stays the same'
      ],
      ['userComment-bluetongue', 'Enter a comment for Bluetongue']
    ])
  })

  test('Should return only the error for a disease with no direction chosen', () => {
    expect(errorsFor({ 'direction-hpai': undefined })).toEqual({
      'direction-hpai':
        'Select whether the risk level for Highly pathogenic avian influenza increases, decreases or stays the same'
    })
  })

  test('Should reject a direction that is not an option', () => {
    expect(errorsFor({ 'direction-asf': 'sideways' })).toEqual({
      'direction-asf':
        'Select whether the risk level for African swine fever increases, decreases or stays the same'
    })
  })

  test('Should reject increasing a disease that is already at the highest level', () => {
    expect(
      errorsFor({ 'direction-asf': 'increase' }, [
        {
          id: 'asf',
          name: 'African swine fever',
          currentRiskLevel: 'very-high'
        }
      ])
    ).toEqual({
      'direction-asf':
        'African swine fever is already at the highest risk level, so it cannot increase'
    })
  })

  test('Should reject decreasing a disease that is already at the lowest level', () => {
    expect(
      errorsFor({ 'direction-bluetongue': 'decrease' }, [
        { id: 'bluetongue', name: 'Bluetongue', currentRiskLevel: 'negligible' }
      ])
    ).toEqual({
      'direction-bluetongue':
        'Bluetongue is already at the lowest risk level, so it cannot decrease'
    })
  })

  test.each([
    ['asf', 'African swine fever'],
    ['hpai', 'Highly pathogenic avian influenza'],
    ['bluetongue', 'Bluetongue']
  ])('Should require a comment for %s', (id, name) => {
    expect(errorsFor({ [`userComment-${id}`]: undefined })).toEqual({
      [`userComment-${id}`]: `Enter a comment for ${name}`
    })
  })

  test('Should require a comment when the risk level stays the same', () => {
    expect(
      errorsFor({ 'direction-hpai': 'same', 'userComment-hpai': '' })
    ).toEqual({
      'userComment-hpai':
        'Enter a comment for Highly pathogenic avian influenza'
    })
  })

  test('Should reject a blank comment', () => {
    expect(errorsFor({ 'userComment-asf': '   ' })).toEqual({
      'userComment-asf': 'Enter a comment for African swine fever'
    })
  })

  test('Should accept a comment of 500 characters', () => {
    expect(errorsFor({ 'userComment-asf': 'a'.repeat(500) })).toBeUndefined()
  })

  test('Should reject a comment over 500 characters', () => {
    expect(errorsFor({ 'userComment-asf': 'a'.repeat(501) })).toEqual({
      'userComment-asf':
        'Comment for African swine fever must be 500 characters or less'
    })
  })

  test('Should count a line break as one character', () => {
    const { value } = validateRiskLevelChange(
      {
        ...validFormPayload(),
        'userComment-asf': `${'a'.repeat(250)}\r\n${'b'.repeat(249)}`
      },
      currentRiskLevels()
    )

    expect(value.changes[0].userComment).toBe(
      `${'a'.repeat(250)}\n${'b'.repeat(249)}`
    )
  })

  test('Should reject a comment over 500 characters once line breaks are counted once', () => {
    expect(
      errorsFor({
        'userComment-asf': `${'a'.repeat(250)}\r\n${'b'.repeat(250)}`
      })
    ).toEqual({
      'userComment-asf':
        'Comment for African swine fever must be 500 characters or less'
    })
  })

  test('Should report a disease that cannot move alongside comment errors', () => {
    expect(
      errorsFor({ 'direction-asf': 'increase', 'userComment-asf': undefined }, [
        {
          id: 'asf',
          name: 'African swine fever',
          currentRiskLevel: 'very-high'
        }
      ])
    ).toEqual({
      'direction-asf':
        'African swine fever is already at the highest risk level, so it cannot increase',
      'userComment-asf': 'Enter a comment for African swine fever'
    })
  })

  test('Should keep the chosen directions and comments when the form has errors', () => {
    const { values } = validateRiskLevelChange(
      { 'direction-asf': 'increase', 'userComment-hpai': 'Kept' },
      currentRiskLevels()
    )

    expect(values).toEqual({
      directions: { asf: 'increase', hpai: undefined, bluetongue: undefined },
      userComments: { asf: undefined, hpai: 'Kept', bluetongue: undefined }
    })
  })
})

describe('#toFormValues', () => {
  test('Should turn a risk level change back into form values', () => {
    expect(toFormValues(validRiskLevelChange())).toEqual({
      directions: { asf: 'increase', hpai: 'same', bluetongue: 'decrease' },
      userComments: {
        asf: 'New outbreaks reported in domestic pigs.',
        hpai: 'No change in wild bird findings.',
        bluetongue: 'Vector season has ended.'
      }
    })
  })

  test('Should round trip through the form', () => {
    const { directions, userComments } = toFormValues(validRiskLevelChange())
    const payload = Object.fromEntries(
      currentRiskLevels().flatMap(({ id }) => [
        [`direction-${id}`, directions[id]],
        [`userComment-${id}`, userComments[id]]
      ])
    )

    expect(validateRiskLevelChange(payload, currentRiskLevels()).value).toEqual(
      validRiskLevelChange()
    )
  })
})
