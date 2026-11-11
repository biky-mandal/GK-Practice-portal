# Client

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.2.20.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Admin sidebar

Use the arrow button at the top of the admin sidebar to collapse it to an
icons-only rail or expand it to show labels again. Navigation stays available
in both modes; hover over an icon to see its label. The collapsed layout gives
the current page more space and also works on smaller screens.

## Question upload review

The admin upload review table shows questions, options, correct option IDs and
answer text, and explanations in separate English and Assamese columns. Question
ID, subject, difficulty, languages, exams, validation status, and upload/edit/remove
actions are also available in the table. Scroll horizontally to review all columns;
column headers stay visible while scrolling through a set.
Use the **Translate options to Assamese** icon immediately after English options to
translate all options for that question together. This replaces existing Assamese
option translations and saves the draft automatically; the Assamese answer text
updates too. Question text, explanations, correct option IDs, and other metadata
are unchanged. Every option needs English text, and the editor must be closed.
The **Translate answer to Assamese** icon between the English and Assamese answer
columns translates only the correct answers and saves them to the draft, also
updating the matching options to keep answer and option text consistent.
The **Translate explanation to Assamese** icon between the English and Assamese
explanation columns replaces the Assamese explanation and saves the draft
automatically. It requires English explanation text and leaves other fields unchanged.
The **Translate question to Assamese** icon between the English and Assamese
question columns similarly translates and saves only the question text.
Review the translations before publishing with the existing upload buttons.
Translation uses the server's existing translation service; failures leave the
draft unchanged and display an error.
Missing translations are shown as `(missing)`, not replaced with the other language.
Existing validation rules still apply: select at least one subject in the editor
before publishing a question with a missing-subject warning.

## Simulation recording

Superadmins can use **Simulation** at `/admin/simulation` for the existing landscape layout,
or **Shorts Simulation** at `/admin/simulation-shorts` for a 9:16 portrait canvas for Reels
and YouTube Shorts. Both pages share subject colors, cards, question history, language
selection, timers, audio, answer reveals, and automatic progression.
Both simulation canvases use a light theme with soft subject-colored backgrounds,
dark text, white option cards and green correct-answer highlights, including the
intro, countdown, explanation and completion screens.
To attach a reference image, open a question's **Edit** form in **Upload Questions**
before publishing, or edit an existing question in **Questions**. The optional
**Reference image** field accepts PNG, JPEG or WebP files up to 512 KB and provides
a preview; selecting another file replaces it, and **Remove image** clears it.
Use **Apply changes** to save. Images are stored with the question, not in a local
browser session.
Regular simulation displays questions/options on the left and the reference image
on the right in equal-width columns. The entire image is fitted without cropping
and stays visible during the answer reveal. In manual playback, the right column
stays empty when there is no image; automatic playback uses the full width for
questions without an image. Shorts Simulation does not display reference images.
In regular simulation's manual playback, enable **Show manual timer** and set its
duration. The right side stays empty until you click the timer icon for each
question, which starts the countdown there instead of showing the image. When
it reaches zero, the answer and any reference image appear; use the arrow to
move on. The eye icon can still reveal
the answer early. Without this option, manual playback works without a timer.
The portrait canvas fits the available screen and stays 9:16 in fullscreen, centered
with black space outside. Crop the recording to the canvas for a portrait video.

Before starting Shorts Simulation, configure the hook text, CTA question and follow
message, all five phase durations, countdown sound and explanation
visibility. Defaults are a 3-second hook, 7-second question reading, 5-second countdown,
6-second answer and 4-second CTA (25 seconds for one question). The hook plays once,
each selected question cycles through reading/countdown/answer, and the CTA plays once
at the end. Questions and options remain visible during countdown; the answer phase
highlights the correct option and, when enabled, shows its explanation without a
duplicate answer label. All durations accept whole seconds
from 1 to 600. Pressing Start simulation starts the hook as soon as the questions
load, without a second Start screen. After the CTA, Thank you!, the logo and
Follow for More appear centered in that order, without the header, completion
count or Finish button. After 3 seconds,
fullscreen exits and the subject picker returns. Landscape timing is unchanged.
Phase labels are not displayed in the portrait video. Space for the countdown is
reserved in the header throughout playback so showing the timer does not shift it.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
