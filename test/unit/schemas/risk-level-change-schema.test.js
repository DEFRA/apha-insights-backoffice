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

  test('Should trim the expert comment and drop fields that are not part of the form', () => {
    const { value } = validateRiskLevelChange(
      {
        ...validFormPayload(),
        expertComment: '  New outbreaks reported in domestic pigs.  ',
        crumb: 'token'
      },
      currentRiskLevels()
    )

    expect(value).toEqual(validRiskLevelChange())
    expect(value).not.toHaveProperty('crumb')
  })

  test('Should return one error per disease and one for the comment when the payload is empty', () => {
    expect(validateRiskLevelChange({}, currentRiskLevels()).errors).toEqual({
      'direction-asf':
        'Select whether the risk level for African swine fever increases, decreases or stays the same',
      'direction-hpai':
        'Select whether the risk level for Highly pathogenic avian influenza increases, decreases or stays the same',
      'direction-bluetongue':
        'Select whether the risk level for Bluetongue increases, decreases or stays the same',
      expertComment: 'Enter your expert comment'
    })
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
        { id: 'bluetongue', name: 'Bluetongue', currentRiskLevel: 'very-low' }
      ])
    ).toEqual({
      'direction-bluetongue':
        'Bluetongue is already at the lowest risk level, so it cannot decrease'
    })
  })

  test('Should reject a blank expert comment', () => {
    expect(errorsFor({ expertComment: '   ' })).toEqual({
      expertComment: 'Enter your expert comment'
    })
  })

  test('Should accept an expert comment of 2000 characters, counting line breaks once', () => {
    const expertComment = `${'a'.repeat(1000)}\r\n${'b'.repeat(999)}`

    expect(errorsFor({ expertComment })).toBeUndefined()
  })

  test('Should reject an expert comment over 2000 characters', () => {
    expect(errorsFor({ expertComment: 'a'.repeat(2001) })).toEqual({
      expertComment: 'Expert comment must be 2000 characters or less'
    })
  })

  test('Should keep the chosen directions and comment when the form has errors', () => {
    const { values } = validateRiskLevelChange(
      { 'direction-asf': 'increase', expertComment: 'Kept' },
      currentRiskLevels()
    )

    expect(values).toEqual({
      directions: { asf: 'increase', hpai: undefined, bluetongue: undefined },
      expertComment: 'Kept'
    })
  })
})

describe('#toFormValues', () => {
  test('Should turn a risk level change back into form values', () => {
    expect(toFormValues(validRiskLevelChange())).toEqual({
      directions: { asf: 'increase', hpai: 'same', bluetongue: 'decrease' },
      expertComment: 'New outbreaks reported in domestic pigs.'
    })
  })
})
