import React, { useState, useEffect } from 'react';
import type { Note } from '../types/Note';
import type { Category } from '../types/Category';
import Editor from '../components/editor/Editor';
import "katex/dist/katex.min.css";
import { v4 as uuidv4 } from 'uuid'


interface CategoryPageProps {
  category: Category;
  goBack: () => void;
  updateCategory: (cat: Category) => void;
}

const toDate = (value: Date | string | number) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value: Date | string | number, withTime = false) => {
  const date = toDate(value);
  if (!date) return "Date invalide";

  if (withTime) {
    return date.toLocaleDateString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return date.toLocaleDateString('fr-FR');
};

const CategoryPage: React.FC<CategoryPageProps> = ({ category, goBack, updateCategory }) => {
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteContent, setNoteContent] = useState("")
  const [lastDeleted, setLastDeleted] = useState<Note | null>(null);  
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  // Créer une note Sans-Titre directement
  const createNote = () => {
    const untitledCount = category.notes.filter(n => n.title.startsWith("Sans-Titre")).length;
    const newNote: Note = {
      id: uuidv4(),
      title: `Sans-Titre ${untitledCount + 1}`,
      content: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const updatedCategory = { ...category, notes: [newNote, ...category.notes] };
    updateCategory(updatedCategory);
    setSelectedNote(newNote);
    setNoteContent("");
  };

  const confirmDeleteNote = () => {
    if (!noteToDelete) return;

    setLastDeleted(noteToDelete);

    const updatedCategory = {
      ...category,
      notes: category.notes.filter(n => n.id !== noteToDelete.id),
    };

    updateCategory(updatedCategory);

    if (selectedNote?.id === noteToDelete.id) {
      setSelectedNote(null);
    }

    setNoteToDelete(null);
  };

  const handleTitleChange = (title: string) => {
    if (!selectedNote) return;
    const updatedNote = { ...selectedNote, title, updatedAt: new Date() };
    setSelectedNote(updatedNote);
    updateCategory({
      ...category,
      updatedAt: new Date(),
      notes: category.notes.map(n => (n.id === updatedNote.id ? updatedNote : n))
    });
  };

  useEffect(() => {
    if (!selectedNote) return;
    if (noteContent === selectedNote.content) return;

    const updatedNote = {
      ...selectedNote,
      content: noteContent,
      updatedAt: new Date(),
    };

    setSelectedNote(updatedNote);
    updateCategory({
      ...category,
      updatedAt: new Date(),
      notes: category.notes.map((n) => (n.id === updatedNote.id ? updatedNote : n)),
    });
  }, [noteContent, selectedNote, category, updateCategory]);

  useEffect(() => {
    const handleUndo = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (!lastDeleted) return;

        const restoredCategory = {
          ...category,
          notes: [lastDeleted, ...category.notes],
        };

        updateCategory(restoredCategory);
        setLastDeleted(null);
      }
    };

    window.addEventListener("keydown", handleUndo);

    return () => {
      window.removeEventListener("keydown", handleUndo);
    };
  }, [lastDeleted, category]);

  useEffect(() => {
    if (category.notes.length === 0) {
      setSelectedNote(null);
      setNoteContent("");
      return;
    }

    const hasSelected =
      selectedNote && category.notes.some((note) => note.id === selectedNote.id);

    if (!hasSelected) {
      const firstNote = category.notes[0];
      setSelectedNote(firstNote);
      setNoteContent(firstNote.content ?? "");
    }
  }, [category.notes, selectedNote]);

  return (
    <div className="h-screen w-screen flex bg-gray-900 text-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 p-4 flex flex-col">
        <button
          className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded mb-4"
          onClick={createNote}
        >
          + Créer une note
        </button>
        <div className="flex-1 overflow-y-auto flex flex-col gap-2">
          {category.notes.map(note => (
            <div
              key={note.id}
              className={`p-3 rounded cursor-pointer transition ${
                selectedNote?.id === note.id
                  ? 'bg-gray-700'
                  : 'hover:bg-gray-700'
              }`}
              onClick={() => {
                setSelectedNote(note);
                setNoteContent(note.content ?? "");
              }}
            >
              {/* Header : titre + bouton */}
              <div className="flex items-center justify-between">
                <div className="font-bold truncate">{note.title}</div>

                <button
                  onClick={(e) => {
                    e.stopPropagation(); // empêche la sélection
                    setNoteToDelete(note);
                  }}
                  className="bg-red-600/20 hover:bg-red-600 px-2 py-1 rounded text-red-400 hover:text-white text-sm transition"
                >
                  ✕
                </button>
              </div>

              {/* Dates */}
              <div className="text-gray-400 text-xs mt-1">
                Créé: {formatDate(note.createdAt)} | Modifié:{" "}
                {formatDate(note.updatedAt, true)}
              </div>
            </div>
          ))}
        </div>
        <button
          className="mt-4 bg-gray-700 hover:bg-gray-600 text-gray-100 px-3 py-2 rounded"
          onClick={goBack}
        >
          ← Retour
        </button>
      </div>

      {/* Main editor */}
      <div className="flex-1 p-4 flex flex-col gap-2 overflow-hidden">
        {selectedNote ? (
          <>
            {/* Titre live */}
            <input
              type="text"
              className="w-full text-2xl font-bold bg-gray-800 border border-gray-700 rounded p-2 text-gray-100"
              value={selectedNote.title}
              onChange={(e) => handleTitleChange(e.target.value)}
            />
            <div className="flex-1 overflow-hidden" data-color-mode="dark">
              <Editor
                value={noteContent}
                onChange={setNoteContent}
              />
            </div>
          </>
        ) : (
          <div className="text-gray-400 text-center mt-20">
            Sélectionnez une note ou créez-en une nouvelle
          </div>
        )}
      </div>
    {noteToDelete && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-gray-800 p-6 rounded border border-gray-700 w-96 text-gray-100">
          <h2 className="font-bold text-lg mb-4">
            Supprimer la note "{noteToDelete?.title}" ?
          </h2>

          <p className="text-gray-400 mb-6">
            Cette action est irréversible.
          </p>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setNoteToDelete(null)}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
            >
              Annuler
            </button>

            <button
              onClick={confirmDeleteNote}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
            >
              Supprimer
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default CategoryPage;