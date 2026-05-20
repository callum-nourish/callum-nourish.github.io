---
title: Parameters
categories: references
---

A [[Service Hierarchy|Service]] can have zero or more parameters. Parameters are the fields shown to a carer when they open an interaction — they are how data is gathered and stored.

When a carer submits an interaction, their input is saved as a `ParameterValue` linked to that interaction instance.

## Types

```typescript
const TYPE_TO_COMPONENT_MAPPING: Record<string, Component> = {
  checkbox: CheckboxParameter,
  combined_multi_search: CombinedDataSetParameter,
  date: DateParameter,
  datetime: DateTimeParameter,
  duration: DurationParameter,
  file: FileParameter,
  medication: MedicationParameter,
  multi: MultiSelectDataSetParameter,
  person_picker: PersonPickerParameter,
  picture: PictureParameter,
  read_only_text: ReadOnlyParameter,
  single_selector_search: SingleSelectDataSetParameter,
}
```

## Notable behaviours

- A numeric parameter can have a target — alarms trigger throughout the day if the actual value doesn't meet the condition.
- A parameter can be marked required, blocking the interaction from being closed until filled in.
- A parameter can be linked to a [[Custom Critical Information|datapoint]] so the value is available across multiple interactions (e.g. a client's weight).

[[Nourish Studio]] uses a render-only preview of parameters via a private npm package — see [[Packaging ParameterList for Nourish Studio]].
