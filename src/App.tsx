import { useState } from 'react';
import Home from './pages/Home';
import CategoryPage from './pages/CategoryPage';
import type { Category } from './types/Category';
import './index.css';

function App() {
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const updateCategory = (cat: Category) => {
    setCategories(categories.map((c) => (c.id === cat.id ? cat : c)));
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
