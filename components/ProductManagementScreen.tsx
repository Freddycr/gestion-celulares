import React, { useState, useEffect } from 'react';
import { Product, Brand, Model } from '../types';
import { getProducts, saveProduct, getBrands, getModels, saveBrand, saveModel } from '../services/api';
import { Html5QrcodeScanner, QrcodeError, QrcodeSuccessCallback } from 'html5-qrcode';

const BarcodeScanner: React.FC<{ onScanSuccess: (decodedText: string) => void, onScanFailure: (error: any) => void }> = ({ onScanSuccess, onScanFailure }) => {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scanner.render(onScanSuccess, onScanFailure);

    return () => {
      scanner.clear().catch(error => {
        console.error("Failed to clear scanner.", error);
      });
    };
  }, [onScanSuccess, onScanFailure]);

  return <div id="reader" style={{ width: '100%' }}></div>;
};


const ProductManagementScreen: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingNewProduct, setIsAddingNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<Omit<Product, 'id'> & { id?: number }>({ type: 'generic', name: '', description: '', price: 0, stock: 0, status: 'No registrado' });
  const [scanningField, setScanningField] = useState<string | null>(null);


  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const productsData = await getProducts();
      setProducts(productsData);
    } catch (err) {
      setError("Error al cargar los productos.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await fetchProducts();
        const fetchedBrands = await getBrands();
        setBrands(fetchedBrands);
        const fetchedModels = await getModels();
        setModels(fetchedModels);
      } catch (err) {
        setError("Error al cargar datos iniciales.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleEdit = (product: Product) => {
    setEditingProduct({ ...product });
    setIsAddingNewProduct(false); // Close new product form if open
  };

  const handleSave = async () => {
    if (!editingProduct) return;

    setIsLoading(true);
    setError(null);

    // Check for duplicates when saving an edited product (excluding itself)
    const isDuplicate = products.some(
      (p) => {
        if (editingProduct.type === 'individual' && p.type === 'individual') {
          return p.id !== editingProduct.id && (p.imei1 === editingProduct.imei1 || p.serialNumber === editingProduct.serialNumber);
        } else if (editingProduct.type === 'generic' && p.type === 'generic') {
          return p.id !== editingProduct.id && p.name.toLowerCase() === editingProduct.name.toLowerCase() && p.description.toLowerCase() === editingProduct.description.toLowerCase();
        }
        return false;
      }
    );

    if (isDuplicate) {
      setError("Error: Ya existe un producto con el mismo IMEI o Número de Serie.");
      setIsLoading(false);
      return;
    }

    try {
      await saveProduct(editingProduct);
      setEditingProduct(null);
      await fetchProducts(); // Refresh the product list
    } catch (err) {
      setError("Error al guardar el producto.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditingProduct(null);
    setIsAddingNewProduct(false);
    setNewProduct({ type: 'generic', name: '', description: '', price: 0, stock: 0, status: 'No registrado', brand: '', model: '', imei1: '', imei2: '', serialNumber: '' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (editingProduct) {
      const updatedProduct = { ...editingProduct, [name]: value };
      if (updatedProduct.type === 'individual' && (name === 'brand' || name === 'model')) {
        updatedProduct.name = `${updatedProduct.brand || ''} ${updatedProduct.model || ''}`.trim();
      }
      setEditingProduct(updatedProduct);
    } else if (isAddingNewProduct) {
      const updatedProduct = { ...newProduct, [name]: value };
      if (updatedProduct.type === 'individual' && (name === 'brand' || name === 'model')) {
        updatedProduct.name = `${updatedProduct.brand || ''} ${updatedProduct.model || ''}`.trim();
      }
      setNewProduct(updatedProduct);
    }
  };

  const handleAddNewProduct = async () => {
    setIsLoading(true);
    setError(null);

    // Check for duplicates before adding a new product
    const isDuplicate = products.some(
      (p) => {
        if (newProduct.type === 'individual' && p.type === 'individual') {
          return (newProduct.imei1 && p.imei1 === newProduct.imei1) || (newProduct.serialNumber && p.serialNumber === newProduct.serialNumber);
        } else if (newProduct.type === 'generic' && p.type === 'generic') {
          return p.name.toLowerCase() === newProduct.name.toLowerCase() && p.description.toLowerCase() === newProduct.description.toLowerCase();
        }
        return false;
      }
    );

    if (isDuplicate) {
      setError("Error: Ya existe un producto con el mismo IMEI o Número de Serie.");
      setIsLoading(false);
      return;
    }

    try {
      // Ensure stock is 1 for individual products right before saving
      const productToSave = { ...newProduct };
      if (productToSave.type === 'individual') {
        productToSave.stock = 1;
      }

      await saveProduct(productToSave);
      setIsAddingNewProduct(false);
      setNewProduct({ type: 'generic', name: '', description: '', price: 0, stock: 0, status: 'No registrado', brand: '', model: '', imei1: '', imei2: '', serialNumber: '' });
      await fetchProducts(); // Refresh the product list
    } catch (err) {
      setError("Error al agregar el producto.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const onScanSuccess: QrcodeSuccessCallback = (decodedText, decodedResult) => {
    if (scanningField) {
      if (editingProduct) {
        setEditingProduct({ ...editingProduct, [scanningField]: decodedText });
      } else if (isAddingNewProduct) {
        setNewProduct({ ...newProduct, [scanningField]: decodedText });
      }
      setScanningField(null);
    }
  };

  const onScanFailure = (error: any) => {
    // handle scan failure, usually better to ignore and keep scanning.
    // console.warn(`Code scan error = ${error}`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-800">Gestión de Productos</h1>

      {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded" role="alert"><p>{error}</p></div>}

      {scanningField && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Escaneando {scanningField}</h2>
            <BarcodeScanner onScanSuccess={onScanSuccess} onScanFailure={onScanFailure} />
            <button onClick={() => setScanningField(null)} className="btn btn-secondary mt-4">Cancelar</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Lista de Productos</h2>
          <button onClick={() => {
            setIsAddingNewProduct(true);
            setEditingProduct(null);
            setNewProduct({ type: 'generic', name: '', description: '', price: 0, stock: 0, status: 'No registrado' });
          }} className="btn btn-primary">+ Agregar Producto</button>
        </div>

        {isAddingNewProduct && (
          <div className="space-y-4 border-b pb-4 mb-4">
            <h3 className="text-lg font-semibold">Nuevo Producto</h3>
            <div className="flex items-center space-x-4">
              <label htmlFor="productType" className="text-gray-700">Tipo de Producto:</label>
              <select
                id="productType"
                name="type"
                value={newProduct.type}
                onChange={e => {
                  const type = e.target.value as 'individual' | 'generic';
                  setNewProduct(prev => ({
                    ...prev,
                    type,
                    stock: type === 'individual' ? 1 : 0, // Set stock to 1 for individual, 0 for generic
                    name: type === 'individual' && prev.brand && prev.model ? `${prev.brand} ${prev.model}`.trim() : prev.name // Update name if brand/model are already set
                  }));
                }}
                className="input-style w-auto"
              >
                <option value="generic">Genérico (Ej: Cargador, Audífonos)</option>
                <option value="individual">Individual (Ej: Teléfono Celular)</option>
              </select>
            </div>

            <input type="text" name="name" placeholder="Nombre del producto (se genera automáticamente para teléfonos)" value={newProduct.name} onChange={handleChange} className="input-style" readOnly={newProduct.type === 'individual'} />
            <textarea name="description" placeholder="Descripción detallada (ej. Color, capacidad, características técnicas, compatibilidad)" value={newProduct.description} onChange={handleChange} className="input-style" />
            <div className="flex items-center space-x-4">
              <label htmlFor="productPrice" className="text-gray-700">Precio:</label>
              <input id="productPrice" type="number" name="price" placeholder="Precio de venta (ej. 999.99)" value={newProduct.price} onChange={handleChange} className="input-style" />
            </div>
            {newProduct.type === 'generic' && (
              <input type="number" name="stock" placeholder="Cantidad en stock (ej. 100)" value={newProduct.stock} onChange={handleChange} className="input-style" />
            )}

            {newProduct.type === 'individual' && (
              <>
                <div className="flex items-center space-x-4">
                  <label htmlFor="productBrand" className="text-gray-700">Marca:</label>
                  <select
                    id="productBrand"
                    name="brand"
                    value={newProduct.brand || ''}
                    onChange={handleChange}
                    className="input-style w-auto"
                  >
                    <option value="">Seleccione una marca</option>
                    {brands.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center space-x-4">
                  <label htmlFor="productModel" className="text-gray-700">Modelo:</label>
                  <select
                    id="productModel"
                    name="model"
                    value={newProduct.model || ''}
                    onChange={handleChange}
                    className="input-style w-auto"
                    disabled={!newProduct.brand}
                  >
                    <option value="">Seleccione un modelo</option>
                    {models
                      .filter(m => {
                        const selectedBrand = brands.find(b => b.name === newProduct.brand);
                        return selectedBrand && m.brandId === selectedBrand.id;
                      })
                      .map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="text" name="imei1" placeholder="IMEI 1" value={newProduct.imei1 || ''} onChange={handleChange} className="input-style flex-grow" />
                  <button onClick={() => setScanningField('imei1')} className="btn btn-secondary">Escanear</button>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="text" name="imei2" placeholder="IMEI 2" value={newProduct.imei2 || ''} onChange={handleChange} className="input-style flex-grow" />
                  <button onClick={() => setScanningField('imei2')} className="btn btn-secondary">Escanear</button>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="text" name="serialNumber" placeholder="Número de Serie" value={newProduct.serialNumber || ''} onChange={handleChange} className="input-style flex-grow" />
                  <button onClick={() => setScanningField('serialNumber')} className="btn btn-secondary">Escanear</button>
                </div>
                <div className="flex items-center space-x-4">
                  <label htmlFor="productStatus" className="text-gray-700">Estado:</label>
                  <select
                    id="productStatus"
                    name="status"
                    value={newProduct.status || 'No registrado'}
                    onChange={handleChange}
                    className="input-style w-auto"
                  >
                    <option value="Registrado">Registrado</option>
                    <option value="No registrado">No registrado</option>
                  </select>
                </div>
              </>
            )}

            <div className="flex space-x-2">
              <button onClick={handleAddNewProduct} className="btn btn-success">Guardar Nuevo</button>
              <button onClick={handleCancel} className="btn btn-secondary">Cancelar</button>
            </div>
          </div>
        )}

        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tipo</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Marca</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Modelo</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">IMEI 1</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">IMEI 2</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Número de Serie</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nombre</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Descripción</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Precio</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Stock</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    {editingProduct && editingProduct.id === product.id ? (
                      <select name="type" value={editingProduct.type} onChange={handleChange} className="input-style">
                        <option value="generic">Genérico</option>
                        <option value="individual">Individual</option>
                      </select>
                    ) : (
                      product.type === 'individual' ? 'Individual' : 'Genérico'
                    )}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    {editingProduct && editingProduct.id === product.id && editingProduct.type === 'individual' ? (
                      <select name="brand" value={editingProduct.brand || ''} onChange={handleChange} className="input-style">
                        <option value="">Seleccione una marca</option>
                        {brands.map(b => (
                          <option key={b.id} value={b.name}>{b.name}</option>
                        ))}
                      </select>
                    ) : (
                      product.brand || 'N/A'
                    )}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    {editingProduct && editingProduct.id === product.id && editingProduct.type === 'individual' ? (
                      <select
                        name="model"
                        value={editingProduct.model || ''}
                        onChange={handleChange}
                        className="input-style"
                        disabled={!editingProduct.brand}
                      >
                        <option value="">Seleccione un modelo</option>
                        {models
                          .filter(m => {
                            const selectedBrand = brands.find(b => b.name === editingProduct.brand);
                            return selectedBrand && m.brandId === selectedBrand.id;
                          })
                          .map(m => (
                            <option key={m.id} value={m.name}>{m.name}</option>
                          ))}
                      </select>
                    ) : (
                      product.model || 'N/A'
                    )}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    {editingProduct && editingProduct.id === product.id && editingProduct.type === 'individual' ? (
                      <div className="flex items-center space-x-2">
                        <input type="text" name="imei1" value={editingProduct.imei1 || ''} onChange={handleChange} className="input-style flex-grow" />
                        <button onClick={() => setScanningField('imei1')} className="btn btn-secondary">Escanear</button>
                      </div>
                    ) : (
                      product.imei1 || 'N/A'
                    )}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text.sm">
                    {editingProduct && editingProduct.id === product.id && editingProduct.type === 'individual' ? (
                      <div className="flex items-center space-x-2">
                        <input type="text" name="imei2" value={editingProduct.imei2 || ''} onChange={handleChange} className="input-style flex-grow" />
                        <button onClick={() => setScanningField('imei2')} className="btn btn-secondary">Escanear</button>
                      </div>
                    ) : (
                      product.imei2 || 'N/A'
                    )}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    {editingProduct && editingProduct.id === product.id && editingProduct.type === 'individual' ? (
                      <div className="flex items-center space-x-2">
                        <input type="text" name="serialNumber" value={editingProduct.serialNumber || ''} onChange={handleChange} className="input-style flex-grow" />
                        <button onClick={() => setScanningField('serialNumber')} className="btn btn-secondary">Escanear</button>
                      </div>
                    ) : (
                      product.serialNumber || 'N/A'
                    )}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    {editingProduct && editingProduct.id === product.id && editingProduct.type === 'individual' ? (
                      <select name="status" value={editingProduct.status || 'No registrado'} onChange={handleChange} className="input-style">
                        <option value="Registrado">Registrado</option>
                        <option value="No registrado">No registrado</option>
                      </select>
                    ) : (
                      product.status || 'N/A'
                    )}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    {editingProduct && editingProduct.id === product.id ? (
                      <input type="text" name="name" value={editingProduct.name} onChange={handleChange} className="input-style" />
                    ) : (
                      product.name
                    )}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    {editingProduct && editingProduct.id === product.id ? (
                      <textarea name="description" value={editingProduct.description} onChange={handleChange} className="input-style" />
                    ) : (
                      product.description
                    )}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    {editingProduct && editingProduct.id === product.id ? (
                      <input type="number" name="price" value={editingProduct.price} onChange={handleChange} className="input-style" />
                    ) : (
                      `${product.price.toFixed(2)}`
                    )}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    {editingProduct && editingProduct.id === product.id && editingProduct.type === 'generic' ? (
                      <input type="number" name="stock" value={editingProduct.stock} onChange={handleChange} className="input-style" />
                    ) : (
                      product.stock
                    )}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right">
                    {editingProduct && editingProduct.id === product.id ? (
                      <div className="flex items-center space-x-2">
                        <button onClick={handleSave} className="btn btn-success text-xs">Guardar</button>
                        <button onClick={handleCancel} className="btn btn-secondary text-xs">Cancelar</button>
                      </div>
                    ) : (
                      <button onClick={() => handleEdit(product)} className="btn btn-primary text-xs">Editar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProductManagementScreen;