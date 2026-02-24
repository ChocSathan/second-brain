import { useEffect, useState } from 'react';
import Home from './pages/Home';
import CategoryPage from './pages/CategoryPage';
import type { Category } from './types/Category';
import { loadCategories, saveCategories } from './store/persistence';
import './index.css';

function App() {
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const loaded = await loadCategories();
      if (!mounted) return;
      setCategories(loaded);
      setIsLoaded(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    saveCategories(categories);
  }, [categories, isLoaded]);

  const updateCategory = (cat: Category) => {
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? cat : c)));
    setCurrentCategory(cat);
  };

  if (currentCategory) {
    return (
      <CategoryPage
        category={currentCategory}
        goBack={() => setCurrentCategory(null)}
        updateCategory={updateCategory}
      />
    );
  }

  return <Home categories={categories} setCategories={setCategories} setCurrentCategory={setCurrentCategory} />;
}

export default App;
