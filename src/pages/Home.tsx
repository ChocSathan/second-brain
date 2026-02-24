import React, { useEffect, useState } from 'react';
import type { Category } from '../types/Category';
import { v4 as uuidv4 } from 'uuid';
import { saveCategories } from '../store/persistence';
import {
  getVaultFolder,
  setVaultFolder as setVaultFolderSetting,
} from '../services/vaultConfig';

interface HomeProps {
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  setCurrentCategory: React.Dispatch<React.SetStateAction<Category | null>>;
}

const Home: React.FC<HomeProps> = ({ categories, setCategories, setCurrentCategory }) => {
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [showDeleteCat, setShowDeleteCat] = useState<Category | null>(null);
  const [showNewCatPopup, setShowNewCatPopup] = useState(false);

  const [vaultFolder, setVaultFolder] = useState<string | null>(null);
  const [showVaultPopup, setShowVaultPopup] = useState(false);
  const [pendingVaultFolder, setPendingVaultFolder] = useState<string | null>(null);

  // Champs pour nouvelle catégorie
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");

  const createCategory = () => {
    if (!newCatName) return;
    const newCat: Category = {
      id: uuidv4(),
      name: newCatName,
      description: newCatDesc,
      notes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setCategories([newCat, ...categories]);
    setNewCatName("");
    setNewCatDesc("");
    setShowNewCatPopup(false);
  };

  // Au premier chargement, on regarde si un dossier de coffre est déjà enregistré.
  // S'il n'y en a pas, on ouvre la popup custom plutôt que la fenêtre native Windows.
  useEffect(() => {
    (async () => {
      const folder = await getVaultFolder();
      if (folder) {
        setVaultFolder(folder);
      } else {
        setShowVaultPopup(true);
      }
    })();
  }, []);

  const deleteCategory = (cat: Category) => {
    setCategories(categories.filter(c => c.id !== cat.id));
    setShowDeleteCat(null);
  };

  const updateCategory = (cat: Category) => {
    cat.updatedAt = new Date(); // update updatedAt
    setCategories(categories.map(c => (c.id === cat.id ? cat : c)));
    setEditCat(null);
  };

  const isElectronWithApi = typeof window !== 'undefined' && typeof window.api?.selectFolder === 'function';

  return (
    <div className="h-screen w-screen bg-gray-900 text-gray-100 p-4">
      {!isElectronWithApi && (
        <div className="bg-amber-900/80 text-amber-200 text-sm px-4 py-2 rounded mb-4" role="alert">
          ⚠️ Sélection de dossier indisponible ici. Lancez <code className="bg-gray-800 px-1 rounded">npm run dev</code> et utilisez la <strong>fenêtre Electron</strong> qui s’ouvre (pas cet onglet navigateur).
        </div>
      )}
      <header className="text-2xl font-bold mb-4 flex justify-between items-center">
        <span>Second Brain</span>
        <div className="flex items-center gap-2">
          <button
            className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm"
            onClick={() => {
              setPendingVaultFolder(vaultFolder);
              setShowVaultPopup(true);
            }}
          >
            Changer le coffre
          </button>
          <button
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded"
            onClick={() => setShowNewCatPopup(true)}
          >
            + Nouvelle Catégorie
          </button>
        </div>
      </header>

      {/* Liste des catégories */}
      <div className="flex flex-col gap-2">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex justify-between items-start p-3 bg-gray-800 rounded border border-gray-700 cursor-pointer hover:bg-gray-700"
            onClick={(e) => {
              // éviter que le clic sur M ou X ouvre la catégorie
              if ((e.target as HTMLElement).tagName === 'BUTTON') return;
              setCurrentCategory(cat);
            }}
          >
          <div className="flex-1">
            <div className="font-bold">{cat.name}</div>
            <div className="text-purple-300">{cat.description}</div>
            <div className="text-gray-400 text-sm mt-1">
              Créé: {cat.createdAt.toLocaleString()} | Modifié: {cat.updatedAt.toLocaleString()}
            </div>
          </div>
          <div className="flex gap-2 mt-1">
            {/* Bouton Modifier */}
            <button
              className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded font-bold"
              onClick={() => setEditCat(cat)}
            >
              M
            </button>

            {/* Bouton Supprimer */}
            <button
              className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded font-bold"
              onClick={() => setShowDeleteCat(cat)}
            >
              X
            </button>
          </div>
        </div>
      ))}
      </div>

      {/* Popup Changer le coffre */}
      {showVaultPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded border border-gray-700 w-96 text-gray-100 flex flex-col gap-3">
            <h3 className="font-bold text-lg mb-1">Changer le coffre</h3>
            <p className="text-sm text-gray-300">
              Sélectionnez le dossier qui contiendra toutes vos notes.
            </p>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 text-xs text-gray-300 bg-gray-900 border border-gray-700 rounded px-2 py-1 truncate">
                  {pendingVaultFolder ?? 'Aucun dossier sélectionné'}
                </div>
                <button
                  className="bg-gray-700 hover:bg-gray-600 text-sm px-3 py-1 rounded"
                  onClick={async () => {
                    if (typeof window.api?.selectFolder !== 'function') {
                      // eslint-disable-next-line no-alert
                      alert("Sélection de dossier indisponible. Lancez l'app avec Electron (npm run dev) et utilisez la fenêtre de l'application.");
                      return;
                    }
                    const folder = await window.api.selectFolder();
                    if (folder) {
                      setPendingVaultFolder(folder);
                    }
                  }}
                >
                  Parcourir...
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-3">
              <button
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                onClick={() => {
                  setShowVaultPopup(false);
                  setPendingVaultFolder(null);
                }}
              >
                Annuler
              </button>
              <button
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!pendingVaultFolder}
                onClick={async () => {
                  if (!pendingVaultFolder) return;
                  const saved = await setVaultFolderSetting(pendingVaultFolder);
                  setVaultFolder(saved);
                  await saveCategories(categories);
                  setShowVaultPopup(false);
                }}
              >
                Utiliser ce dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup Nouvelle Catégorie */}
      {showNewCatPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded border border-gray-700 w-96 text-gray-100 flex flex-col gap-2">
            <h3 className="font-bold text-lg mb-2">Nouvelle Catégorie</h3>
            <input
              type="text"
              placeholder="Nom"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="border border-gray-700 p-2 rounded bg-gray-900 text-gray-100"
            />
            <input
              type="text"
              placeholder="Description"
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
              className="border border-gray-700 p-2 rounded bg-gray-900 text-gray-100"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                onClick={() => setShowNewCatPopup(false)}
              >
                Annuler
              </button>
              <button
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded"
                onClick={createCategory}
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup Supprimer */}
      {showDeleteCat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded border border-gray-700 w-96 text-gray-100">
            <h3 className="font-bold text-lg mb-4">Supprimer "{showDeleteCat.name}" ?</h3>
            
            <p className="text-gray-400 mb-6">
              Cette action est irréversible.
            </p>

            <div className="flex justify-end gap-2">
              <button
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                onClick={() => setShowDeleteCat(null)}
              >
                Annuler
              </button>
              <button
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                onClick={() => deleteCategory(showDeleteCat)}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup Modifier */}
      {editCat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded border border-gray-700 w-96 text-gray-100 flex flex-col gap-2">
            <h3 className="font-bold text-lg mb-2">Modifier "{editCat.name}"</h3>
            <input
              type="text"
              value={editCat.name}
              onChange={(e) => setEditCat({ ...editCat, name: e.target.value })}
              className="border border-gray-700 p-2 rounded bg-gray-900 text-gray-100"
            />
            <input
              type="text"
              value={editCat.description}
              onChange={(e) => setEditCat({ ...editCat, description: e.target.value })}
              className="border border-gray-700 p-2 rounded bg-gray-900 text-gray-100"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                onClick={() => setEditCat(null)}
              >
                Annuler
              </button>
              <button
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                onClick={() => updateCategory(editCat)}
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;