import React, { useState } from 'react';
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Product } from '@shared/schema';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus, Pencil, Tag, ImagePlus, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// Esquema de validación para el formulario de producto
const productFormSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  sku: z.string().optional(),
  price: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface ProductListProps {
  projectId: number;
}

export default function ProductList({ projectId }: ProductListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Formulario para crear/editar productos
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '',
      description: '',
      sku: '',
      price: '',
    },
  });

  // Cargar la lista de productos
  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ['projects', projectId, 'products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return fromDbArray<Product>("products", data);
    },
  });

  // Mutación para crear productos
  const createProductMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const imageFile = data.get('image') as File | null;
      let imageUrl: string | null = null;

      // Subir imagen a Storage si existe
      if (imageFile) {
        const filePath = `${projectId}/${Date.now()}-${imageFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, imageFile, { upsert: true });

        if (uploadError) throw new Error('Error al subir la imagen: ' + uploadError.message);

        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
      }

      // Crear producto en la base de datos
      const productData: Record<string, any> = {
        name: data.get('name'),
        project_id: projectId,
      };

      if (data.get('description')) productData.description = data.get('description');
      if (data.get('sku')) productData.sku = data.get('sku');
      if (data.get('price')) productData.price = parseFloat(data.get('price') as string);
      if (imageUrl) productData.image_url = imageUrl;

      const { data: product, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();

      if (error) throw new Error('Error al crear el producto: ' + error.message);
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'products'] });
      toast({
        title: 'Producto creado',
        description: 'El producto se ha creado correctamente',
      });
      setIsAddDialogOpen(false);
      form.reset();
      setSelectedFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear el producto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutación para actualizar productos
  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormData }) => {
      const imageFile = data.get('image') as File | null;
      let imageUrl: string | null = null;

      // Subir nueva imagen a Storage si existe
      if (imageFile) {
        const filePath = `${projectId}/${Date.now()}-${imageFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, imageFile, { upsert: true });

        if (uploadError) throw new Error('Error al subir la imagen: ' + uploadError.message);

        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
      }

      // Actualizar producto en la base de datos
      const productData: Record<string, any> = {
        name: data.get('name'),
      };

      if (data.get('description')) productData.description = data.get('description');
      if (data.get('sku')) productData.sku = data.get('sku');
      if (data.get('price')) productData.price = parseFloat(data.get('price') as string);
      if (imageUrl) productData.image_url = imageUrl;

      const { data: product, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error('Error al actualizar el producto: ' + error.message);
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'products'] });
      toast({
        title: 'Producto actualizado',
        description: 'El producto se ha actualizado correctamente',
      });
      setEditingProduct(null);
      form.reset();
      setSelectedFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar el producto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutación para eliminar productos
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      await dbQuery("products").delete({ id: productId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'products'] });
      toast({
        title: 'Producto eliminado',
        description: 'El producto se ha eliminado correctamente',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar el producto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Manejo de envío del formulario
  const onSubmit = (values: ProductFormValues) => {
    const formData = new FormData();
    formData.append('name', values.name);
    
    if (values.description) {
      formData.append('description', values.description);
    }
    
    if (values.sku) {
      formData.append('sku', values.sku);
    }
    
    if (values.price) {
      formData.append('price', values.price);
    }
    
    if (selectedFile) {
      formData.append('image', selectedFile);
    }

    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data: formData });
    } else {
      createProductMutation.mutate(formData);
    }
  };

  // Manejar carga de archivos
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Abrir diálogo de edición
  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      description: product.description || '',
      sku: product.sku || '',
      price: product.price ? String(product.price) : '',
    });
  };

  // Cerrar diálogo y resetear formulario
  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setEditingProduct(null);
    form.reset();
    setSelectedFile(null);
  };

  if (isLoading) {
    return <div className="flex justify-center py-8">Cargando productos...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertDescription>Error al cargar los productos</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Productos</h2>
        <Dialog open={isAddDialogOpen || editingProduct !== null} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Agregar Producto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Editar Producto' : 'Agregar Producto'}</DialogTitle>
              <DialogDescription>
                Completa la información para {editingProduct ? 'actualizar' : 'crear'} el producto.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del producto*</FormLabel>
                      <FormControl>
                        <Input placeholder="Ingrese nombre del producto" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descripción del producto" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SKU</FormLabel>
                        <FormControl>
                          <Input placeholder="SKU del producto" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="Precio" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <FormLabel htmlFor="product-image">Imagen del producto</FormLabel>
                  <div className="flex items-center gap-4">
                    <Input
                      id="product-image"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="flex-1"
                    />
                    {selectedFile && (
                      <p className="text-sm text-muted-foreground">
                        {selectedFile.name}
                      </p>
                    )}
                  </div>
                  {editingProduct?.imageUrl && !selectedFile && (
                    <div className="text-sm text-muted-foreground">
                      Imagen actual: {editingProduct.imageUrl}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" type="button" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={
                      createProductMutation.isPending || 
                      updateProductMutation.isPending
                    }
                  >
                    {(createProductMutation.isPending || updateProductMutation.isPending) 
                      ? 'Guardando...' 
                      : (editingProduct ? 'Actualizar' : 'Crear')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-8 border rounded-lg bg-muted/30">
          <Package className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No hay productos</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Agrega productos para este proyecto haciendo clic en "Agregar Producto".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product: Product) => (
            <Card key={product.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{product.name}</CardTitle>
                {product.sku && (
                  <CardDescription className="flex items-center">
                    <Tag className="mr-1 h-3 w-3" /> {product.sku}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {product.imageUrl && (
                  <div className="relative h-40 w-full overflow-hidden rounded-md">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                {!product.imageUrl && (
                  <div className="flex h-40 items-center justify-center rounded-md bg-muted/30">
                    <ImagePlus className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {product.description}
                  </p>
                )}
                {product.price && (
                  <div className="font-medium">
                    Precio: ${parseFloat(product.price.toString()).toFixed(2)}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" size="sm" onClick={() => handleEditProduct(product)}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. ¿Estás seguro de que deseas eliminar este producto?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteProductMutation.mutate(product.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteProductMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}