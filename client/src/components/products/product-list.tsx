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
import { Trash2, Plus, Pencil, Tag, Package, Image as ImageIcon, Box } from 'lucide-react';
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
import { Skeleton } from "@/components/ui/skeleton";

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

      if (error) throw new Error('Error al crear: ' + error.message);
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'products'] });
      toast({ title: 'Oferta creada' });
      setIsAddDialogOpen(false);
      form.reset();
      setSelectedFile(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error al crear', description: error.message, variant: 'destructive' });
    },
  });

  // Mutación para actualizar productos
  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormData }) => {
      const imageFile = data.get('image') as File | null;
      let imageUrl: string | null = null;

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

      if (error) throw new Error('Error al actualizar: ' + error.message);
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'products'] });
      toast({ title: 'Oferta actualizada' });
      setEditingProduct(null);
      form.reset();
      setSelectedFile(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error al actualizar', description: error.message, variant: 'destructive' });
    },
  });

  // Mutación para eliminar productos
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      await dbQuery("products").delete({ id: productId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'products'] });
      toast({ title: 'Oferta eliminada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' });
    },
  });

  // Manejo de envío del formulario
  const onSubmit = (values: ProductFormValues) => {
    const formData = new FormData();
    formData.append('name', values.name);
    if (values.description) formData.append('description', values.description);
    if (values.sku) formData.append('sku', values.sku);
    if (values.price) formData.append('price', values.price);
    if (selectedFile) formData.append('image', selectedFile);

    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data: formData });
    } else {
      createProductMutation.mutate(formData);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      description: product.description || '',
      sku: product.sku || '',
      price: product.price ? String(product.price) : '',
    });
  };

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setEditingProduct(null);
    form.reset();
    setSelectedFile(null);
  };

  const formatPrice = (price: any) => {
    if (price === null || price === undefined || price === '') return null;
    const num = parseFloat(price);
    if (isNaN(num)) return null;
    const formatter = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    });
    const formatted = formatter.format(num);
    return `${formatted.replace(/\s*[A-Z]{3}$/, '')} MXN`;
  };

  const renderSkeletons = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="overflow-hidden border-border/50 shadow-sm">
          <Skeleton className="h-48 w-full rounded-none" />
          <CardContent className="p-5 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="flex justify-between items-center pt-4">
              <Skeleton className="h-5 w-1/3" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-20" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <h2 className="text-2xl font-heading font-bold tracking-tight text-foreground">Oferta y catálogo</h2>
          <p className="text-muted-foreground leading-relaxed">
            Organiza los productos y servicios que Chantia utilizará como referencia para contenidos y decisiones estratégicas.
          </p>
          {!isLoading && !error && (
            <div className="text-sm font-medium text-muted-foreground/80 pt-1">
              {products.length === 0 ? "Sin ofertas" : products.length === 1 ? "1 oferta" : `${products.length} ofertas`}
            </div>
          )}
        </div>
        
        <Dialog open={isAddDialogOpen || editingProduct !== null} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsAddDialogOpen(true)} className="rounded-full shrink-0 shadow-sm">
              <Plus className="mr-2 h-4 w-4" /> Agregar oferta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:rounded-2xl p-0 gap-0">
            <DialogHeader className="p-6 md:p-8 border-b border-border/50 bg-muted/5 sticky top-0 z-10 backdrop-blur-sm">
              <DialogTitle className="text-2xl font-heading">
                {editingProduct ? 'Editar oferta' : 'Nueva oferta'}
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground mt-1.5">
                {editingProduct 
                  ? 'Actualiza los detalles del producto o servicio.' 
                  : 'Agrega un nuevo producto o servicio al catálogo de la marca.'}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 md:p-8 space-y-10">
                
                {/* Bloque 1: Información principal */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Información principal</h3>
                  </div>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Nombre del producto o servicio*</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. Consultoría estratégica, Suscripción mensual..." className="bg-muted/30" {...field} />
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
                        <FormLabel className="text-sm font-medium">Descripción</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe qué incluye, para quién es y su propuesta de valor..." 
                            className="resize-none min-h-[120px] bg-muted/30 leading-relaxed" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Bloque 2: Información comercial */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Información comercial</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Referencia interna</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej. SKU-1234, B2B-PLAN" className="bg-muted/30" {...field} />
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
                          <FormLabel className="text-sm font-medium">Precio en MXN</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00" 
                                className="pl-7 bg-muted/30" 
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Bloque 3: Imagen */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Imagen opcional</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <Input
                        id="product-image"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="flex-1 cursor-pointer file:cursor-pointer file:bg-primary/10 file:text-primary file:border-0 file:rounded-md file:px-4 file:py-1 hover:file:bg-primary/20 file:transition-colors file:mr-4 file:font-medium"
                      />
                    </div>
                    {selectedFile && (
                      <p className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Package className="h-4 w-4" /> {selectedFile.name} (Lista para subir)
                      </p>
                    )}
                    {editingProduct?.imageUrl && !selectedFile && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" /> Tiene una imagen asignada actualmente.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-border/50">
                  <Button variant="ghost" type="button" onClick={handleCloseDialog} className="rounded-full px-6">
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    className="rounded-full px-8 shadow-sm"
                    disabled={createProductMutation.isPending || updateProductMutation.isPending}
                  >
                    {(createProductMutation.isPending || updateProductMutation.isPending) 
                      ? 'Guardando...' 
                      : (editingProduct ? 'Guardar cambios' : 'Crear oferta')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        renderSkeletons()
      ) : error ? (
        <Alert variant="destructive" className="border-destructive/20 bg-destructive/5 rounded-xl">
          <AlertDescription className="text-base py-2">
            <div className="font-heading font-bold mb-1">No pudimos cargar tu catálogo.</div>
            Vuelve a intentarlo para consultar los productos y servicios de este proyecto.
          </AlertDescription>
        </Alert>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center border rounded-2xl bg-card border-border/50 shadow-sm animate-in fade-in duration-500">
          <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
            <Box className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-xl font-heading font-bold text-foreground mb-2">Tu catálogo todavía está vacío.</h3>
          <p className="text-muted-foreground max-w-md leading-relaxed mb-8">
            Agrega los productos o servicios principales para que Chantia comprenda mejor lo que ofrece este proyecto.
          </p>
          <Button onClick={() => setIsAddDialogOpen(true)} className="rounded-full px-8 shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Agregar primera oferta
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product: Product) => (
            <Card key={product.id} className="overflow-hidden border-border/50 shadow-sm hover:border-border/80 transition-all duration-200 group flex flex-col bg-card">
              <div className="relative h-48 w-full bg-muted/20 border-b border-border/30 overflow-hidden shrink-0 flex items-center justify-center">
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      if (e.currentTarget.nextElementSibling) {
                        e.currentTarget.nextElementSibling.classList.remove('hidden');
                      }
                    }}
                  />
                )}
                <div className={`absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30 bg-muted/10 ${product.imageUrl ? 'hidden' : ''}`}>
                  <Box className="h-12 w-12 mb-2 opacity-50" />
                  <span className="text-xs font-medium uppercase tracking-wider opacity-60">Sin imagen</span>
                </div>
              </div>
              <CardContent className="p-5 flex-1 flex flex-col gap-3">
                <div>
                  <h3 className="text-lg font-bold text-foreground line-clamp-2 leading-tight">{product.name}</h3>
                  {product.sku && (
                    <div className="inline-flex items-center text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md mt-2">
                      <Tag className="mr-1.5 h-3 w-3" /> Referencia interna: {product.sku}
                    </div>
                  )}
                </div>
                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed mt-1">
                    {product.description}
                  </p>
                )}
                {product.price != null && (
                  <div className="mt-auto pt-4 text-foreground font-bold tracking-tight">
                    {formatPrice(product.price)}
                  </div>
                )}
              </CardContent>
              <CardFooter className="p-4 pt-0 border-t border-border/20 bg-muted/5 flex items-center justify-between gap-2">
                <Button 
                  variant="ghost" 
                  className="flex-1 text-muted-foreground hover:text-foreground hover:bg-background rounded-lg"
                  onClick={() => handleEditProduct(product)}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </Button>
                <div className="w-px h-6 bg-border/50 shrink-0" />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="flex-1 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="sm:rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-heading">¿Eliminar esta oferta?</AlertDialogTitle>
                      <AlertDialogDescription className="text-base text-muted-foreground">
                        Esta acción eliminará el producto o servicio del catálogo y no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6 gap-3 sm:gap-2">
                      <AlertDialogCancel className="rounded-full sm:mt-0">Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteProductMutation.mutate(product.id)}
                        className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm"
                      >
                        {deleteProductMutation.isPending ? 'Eliminando...' : 'Eliminar oferta'}
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