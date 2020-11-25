const path = require("path");
const express = require("express");
const xss = require("xss");
const NotesService = require("./notes-service");

const notesRouter = express.Router();
const jsonParser = express.json();

const serializeNote = (note) => ({
  ...note,
  name: xss(note.name),
  content: xss(note.content),
});

notesRouter
  .route("/")
  .get((req, res, next) => {
    NotesService.getAllNotes(req.app.get("db"))
      .then((notes) => {
        console.log("notes found!");
        res.json(notes.map(serializeNote));
      })
      .catch(next);
  })
  .post(jsonParser, (req, res, next) => {
    const { name, content, date_modified, folder_id } = req.body;
    const newNote = { name, content, folder_id };

    for (const [key, value] of Object.entries(newNote)) {
      if (value == null) {
        return res.status(400).json({
          error: { message: `Missing '${key}' in request body` },
        });
      }
    }
    // TODO: validate that 'folder_id' is an id in the folder table

    newNote.date_modified = date_modified;

    NotesService.insertNote(req.app.get("db"), serializeNote(newNote))
      .then((note) => {
        res
          .status(201)
          .location(path.posix.join(req.originalUrl, `/${note.id}`))
          .json(note);
      })
      .catch(next);
  });

notesRouter
  .route("/:note_id")
  .all((req, res, next) => {
    NotesService.getById(req.app.get("db"), req.params.note_id)
      .then((note) => {
        if (!note) {
          return res.status(404).json({
            error: { message: "note doesn't exist" },
          });
        }
        res.note = note;
        next();
      })
      .catch(next);
  })
  .get((req, res, next) => {
    res.json(serializeNote(res.note));
  })
  .patch(jsonParser, (req, res, next) => {
    const { name, content, date_modified, folder_id } = req.body;
    const noteToUpdate = { name, content, date_modified, folder_id };

    const numberOfValues = Object.values(noteToUpdate).filter(Boolean).length;
    if (numberOfValues === 0) {
      return res.status(400).json({
        error: {
          message: `Request body must contain either 'name', 'content', 'date_modified' or 'folder_id'`,
        },
      });
    }

    NotesService.updateNote(req.app.get("db"), req.params.note_id, noteToUpdate)
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  })
  .delete((req, res, next) => {
    NotesService.deleteNote(req.app.get("db"), req.params.note_id)
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  });

module.exports = notesRouter;
