# Patient Agency

This page is the heart of the project. The README has a short pointer; this is the full story.

## The problem

Most people do not have a health data problem. They have a health coordination problem.

Their labs are in one place. Their imaging reports are somewhere else. Their medications change over time. Their wearable signals are disconnected. Their portal messages are buried. Their caregivers are overloaded. Their clinicians are busy.

The result is that a lot of personal health information exists, and almost none of it is organized in a way that helps the person whose health it describes. Worse, the standard answer to that problem (the next platform, the next consumer health app, the next AI chatbot) usually asks the user to hand their data over in exchange for organization. That is not agency. That is rent.

Tula exists to give individuals and caregivers a private AI workspace for understanding and organizing their own health information, without handing that data to another closed platform.

## The vision

The larger vision is patient agency: a world where every person can have an AI agent that helps them stay informed, prepared, and engaged in their care.

An informed patient is not a patient who memorizes their labs. It is a patient who arrives at a clinical encounter with the right context, the right questions, and a clear picture of how their condition has been trending. An informed caregiver is not a caregiver who keeps a spreadsheet. It is a caregiver who has a coordinator that quietly tracks medications, appointments, follow-ups, and the small longitudinal details that are easy to lose under the weight of daily life.

Patient agency is the opposite of patient passivity. It is the patient and their caregivers having an AI working for them, on their hardware, under their consent, with their data.

## Why this team is building it

The people building this project are not doing so as a technical exercise. They are doing it because the problem is personal.

Paul Swider (the creator) lost his mother, Tula, to brain cancer. She was a Mensa member, a mother of five, and one of the sharpest and most direct people he has ever known. The project is named in her memory, and built in her spirit: warm, sharp, and unwavering in service of the people she loved. Paul also carries hereditary risk factors he is determined to monitor proactively. Tula is the AI agent he wishes he had been able to give her, and the AI agent he wants for himself.

Sal Rosales is building Tula because his wife is undergoing cancer treatment. The demands of caregiving alongside daily life require better tools for tracking medications, understanding test results, and staying organized across multiple providers. Tula is the caregiver-side AI he needs to run his household through treatment.

The architecture that supports a healthy individual in tracking wellness metrics is the same architecture that supports a patient in managing treatment adherence, or a caregiver in coordinating complex care. It is one platform that adapts to the user's needs.

## Caregiver recognition

Caregivers are not a secondary audience for Tula. They are a first-class audience.

A meaningful share of all healthcare-adjacent labor in the world is done by uncompensated caregivers, often family members or close friends, tracking medications, watching for changes, coordinating appointments, listening, advocating, and quietly carrying the patient through their care. Software that pretends caregivers are not in the loop, or that pretends a chatbot can stand in for a caregiver, is not honest software.

Tula is designed so that the same agent that supports a patient can also be configured (with consent) to support a caregiver, with the same workspace memory, the same record cache, and the same evaluation discipline.

## Global health equity

Open source, self-hosted, model-agnostic, and accessible on low-bandwidth networks: Tula is designed so that a clinic in a low-resource setting has access to the same tools as a patient in a high-income country. The reference deployment runs on a small VM that costs about $30 per month, with optional voice on top, and the open-weight model story (vLLM, MedGemma, Llama, Mistral, Qwen) means the same agent can run in air-gapped environments where external API access is not feasible.

Patient agency only matters if patients can access it. We are building toward an agent that can run anywhere a person needs it.

## Why this matters for healthcare organizations

If patient agents become common, hospitals will need governed infrastructure for safety, consent, identity, escalation, audit, and workflow integration. That is the role of Aria, the commercial hospital-scale platform RealActivity is developing on the same foundation.

Tula and Aria are not in tension. The whole point of the open-core model is that the patient gets a self-hosted agent on their own terms, and the organizations that care for them get governed infrastructure to interoperate with that agent safely. Both sides of that handshake have to exist for patient agency to actually work at scale.

See [`docs/aria-commercial-platform.md`](aria-commercial-platform.md) and [`docs/enterprise-pilots.md`](enterprise-pilots.md) for the commercial side of that story.

## See also

- [`README.md`](../README.md), the front-door summary
- [`docs/use-cases.md`](use-cases.md), concrete personal-health use cases
- [`docs/example-flows.md`](example-flows.md), example agent flows
- [`docs/safety-and-disclaimer.md`](safety-and-disclaimer.md), what Tula is and is not
- [`docs/aria-commercial-platform.md`](aria-commercial-platform.md), the commercial extension
- [`docs/principles.md`](principles.md), the full set of project principles
