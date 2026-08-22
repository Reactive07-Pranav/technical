# UN-देखा — On-Demand Format Conversion

UN-देखा is a hackathon-ready front-end prototype for accessible, on-demand learning conversion. It turns a single learning resource into a connected, personalized pathway instead of a one-size-fits-all export.

The project is presented by **Apex Protocol**. Select the student-profile card in the sidebar to add your name before the demo.

## Final build features

- **Learning pathways, not file conversions:** one upload becomes audio, synced captions, plain-language notes, and an interactive flowchart.
- **Student-controlled defaults:** learners choose their access preferences once, then apply them to every conversion.
- **Cross-resource concept map:** multiple saved PDFs or documents are connected by their resource-topic keywords.
- **Accessible from the start:** keyboard-friendly controls, readable hierarchy, responsive layout, dark mode, reduced-motion support, clear status feedback, and deliberate color contrast.
- **Clean library:** no seeded example content; reset the library from the My Library header whenever you want a fresh session.

## Run it

Open `index.html` in any modern browser. No install, API key, or build process is required.

## Demo flow

1. Press **Transform a resource** and select a file, or choose **Paste text**.
2. Pick the formats that suit the learner.
3. Click **Create my learning pathway**.
4. Open the generated pathway from My Library and use its formats.
5. Add a second resource to activate the cross-resource concept map.

## Suggested hackathon pitch

> "Most accessibility tools make a second version of a resource. UN-देखा creates one connected learning pathway, where every learner can move between audio, captions, clear notes, flowcharts, and linked resources without losing context."

Use `HACKATHON-PITCH.md` for the detailed problem framing, demo script, architecture, and judge-facing differentiation.

## Production integrations to add next

- OCR and document layout parsing (for example, Azure Document Intelligence or Google Document AI)
- Text simplification and image-description generation with an LLM
- Speech synthesis / speech recognition
- Live caption streaming for lectures
- Learner profiles, secure storage, and educator analytics
