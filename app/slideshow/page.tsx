"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/legacy/image";
import { drawHookText } from "@/lib/utils";
import { toast } from "react-toastify";
import { ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import { useRouter } from "next/navigation";
import { downloadSlideshowsAsZip } from "@/utils/slideshowZipDownloader";

export default function SlideshowPage() {
  const { user } = useAuth();
  
  // Charger l'état sauvegardé depuis localStorage
  const loadSavedState = () => {
    if (typeof window === 'undefined' || !user) return {};
    const saved = localStorage.getItem(`slideshow-form-${user.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading saved state:', e);
        return {};
      }
    }
    return {};
  };
  
  const savedState = loadSavedState();
  
  // États pour le slideshow avec valeurs sauvegardées
  const [slideshowImageCount, setSlideshowImageCount] = useState<number>(savedState.slideshowImageCount || 5);
  const [slideshowImages, setSlideshowImages] = useState<File[]>([]);
  const [slideshowHooksPerImage, setSlideshowHooksPerImage] = useState<{[key: number]: string}>(savedState.slideshowHooksPerImage || {});
  const [slideshowUploadMode, setSlideshowUploadMode] = useState<'ordered' | 'random'>(savedState.slideshowUploadMode || 'ordered');
  const [slideshowsToCreate, setSlideshowsToCreate] = useState<number>(savedState.slideshowsToCreate || 1);
  const [hooks, setHooks] = useState<string>(savedState.hooks || ''); // Hook principal pour le slideshow
  const [hookMode, setHookMode] = useState<'first' | 'each'>(savedState.hookMode || 'each');
  const [selectedStyles, setSelectedStyles] = useState<Set<number>>(new Set(savedState.selectedStyles || [2]));
  const [currentStyle, setCurrentStyle] = useState<number>(savedState.currentStyle || 2);
  const [style1Position, setStyle1Position] = useState<{position: 'top' | 'middle' | 'bottom', offset: number}>(
    savedState.style1Position || { position: 'top', offset: 0 }
  );
  const [style2Position, setStyle2Position] = useState<{position: 'top' | 'middle' | 'bottom', offset: number}>(
    savedState.style2Position || { position: 'top', offset: 0 }
  );
  const [style3Position, setStyle3Position] = useState<{position: 'top' | 'middle' | 'bottom', offset: number}>(
    savedState.style3Position || { position: 'top', offset: 0 }
  );
  const [style4Position, setStyle4Position] = useState<{position: 'top' | 'middle' | 'bottom', offset: number}>(
    savedState.style4Position || { position: 'middle', offset: 0 }
  );
  
  // États pour les collections d'images
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<any>(null);
  const [imageCollections, setImageCollections] = useState<any[]>([]);
  const [collectionMode, setCollectionMode] = useState<'one-for-all' | 'per-position' | 'multiple-collections'>(savedState.collectionMode || 'one-for-all');
  const [selectedCollectionsByPosition, setSelectedCollectionsByPosition] = useState<{[key: number]: any}>({});
  const [selectedMultipleCollections, setSelectedMultipleCollections] = useState<any[]>([]);
  const [currentSelectionStep, setCurrentSelectionStep] = useState(0);
  const [collectionModalPage, setCollectionModalPage] = useState(1);
  const collectionsPerPage = 12; // 3 lignes × 4 colonnes
  
  // État pour le carousel de preview
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  
  // États temporaires pour éviter les erreurs de compilation
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [songs, setSongs] = useState<any[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Restaurer les collections et chansons depuis les IDs sauvegardés
  useEffect(() => {
    if (!savedState) return;
    
    // Restaurer la collection sélectionnée
    if (savedState.selectedCollectionId && imageCollections.length > 0) {
      const collection = imageCollections.find((c: any) => c.id === savedState.selectedCollectionId);
      if (collection) setSelectedCollection(collection);
    }
    
    // Restaurer les collections par position
    if (savedState.selectedCollectionsByPositionIds && imageCollections.length > 0) {
      const restoredCollections: any = {};
      Object.entries(savedState.selectedCollectionsByPositionIds).forEach(([key, id]) => {
        const collection = imageCollections.find((c: any) => c.id === id);
        if (collection) {
          restoredCollections[parseInt(key)] = collection;
        }
      });
      if (Object.keys(restoredCollections).length > 0) {
        setSelectedCollectionsByPosition(restoredCollections);
      }
    }
  }, [imageCollections]); // Se déclenche quand les données sont chargées
  
  // Sauvegarder l'état dans localStorage quand il change
  useEffect(() => {
    if (!user) return;
    
    const stateToSave = {
      slideshowImageCount,
      slideshowHooksPerImage,
      slideshowUploadMode,
      slideshowsToCreate,
      hooks,
      hookMode,
      selectedStyles: Array.from(selectedStyles),
      currentStyle,
      style1Position,
      style2Position,
      style3Position,
      style4Position,
      // Ne sauvegarder que les IDs, pas les objets complets
      selectedCollectionId: selectedCollection?.id || null,
      collectionMode,
      selectedCollectionsByPositionIds: Object.keys(selectedCollectionsByPosition).reduce((acc: any, key) => {
        acc[key] = selectedCollectionsByPosition[parseInt(key)]?.id || null;
        return acc;
      }, {})
    };
    
    try {
      localStorage.setItem(`slideshow-form-${user.id}`, JSON.stringify(stateToSave));
    } catch (e) {
      // Si le localStorage est plein, essayer de nettoyer les anciennes données
      if (e instanceof DOMException && e.code === 22) {
        console.warn('localStorage is full, clearing old data...');
        // Nettoyer les anciennes clés de cet utilisateur
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('slideshow-form-') && !key.endsWith(user.id)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        // Réessayer avec les données minimales
        try {
          const minimalState = {
            hooks,
            hookMode,
            currentStyle,
            selectedCollectionId: selectedCollection?.id || null,
                };
          localStorage.setItem(`slideshow-form-${user.id}`, JSON.stringify(minimalState));
        } catch (e2) {
          console.error('Could not save form state:', e2);
        }
      }
    }
  }, [
    user,
    slideshowImageCount,
    slideshowHooksPerImage,
    slideshowUploadMode,
    slideshowsToCreate,
    hooks,
    hookMode,
    selectedStyles,
    currentStyle,
    style1Position,
    style2Position,
    style3Position,
    style4Position,
    selectedCollection,
    collectionMode,
    selectedCollectionsByPosition
  ]);
  
  // États pour la génération
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedSlideshows, setGeneratedSlideshows] = useState<string[]>([]);
  const [generatedSlideshowsImages, setGeneratedSlideshowsImages] = useState<{[key: string]: string[]}>({});
  const [generatedCount, setGeneratedCount] = useState(0);
  const [totalToGenerate, setTotalToGenerate] = useState(0);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [currentGeneratedPreviewIndex, setCurrentGeneratedPreviewIndex] = useState(0);
  const [slideshowImageIndexes, setSlideshowImageIndexes] = useState<{[key: string]: number}>({});
  const router = useRouter();

  // Dessiner le hook sur le canvas
  useEffect(() => {
    const drawCanvas = async () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // Set canvas size to match video dimensions (1080x1920) like Create Videos
          canvas.width = 1080;
          canvas.height = 1920;
          
          // Clear previous content
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Obtenir le hook à afficher (priorité au hook principal)
          let hookText = '';
          if (hooks && hooks.trim()) {
            // Utiliser la première ligne du hook principal s'il existe
            const hookLinesPreview = hooks.split('\n').filter(line => line.trim());
            hookText = hookLinesPreview[0] || '';
          } else {
            // Sinon utiliser les hooks par image
            const firstHooks = slideshowHooksPerImage[0] || Object.values(slideshowHooksPerImage)[0] || '';
            const lines = firstHooks.split('\n').filter(line => line.trim() !== '');
            hookText = lines[0] || '';
          }
          
          if (hookText.trim()) {
            console.log("Drawing hook with style:", currentStyle);
            console.log("Hook text:", hookText);
            
            // Attendre que les fonts soient chargées
            await document.fonts.ready;
            
            // Draw hook text using shared function - exactly like Create Videos
            drawHookText(ctx, hookText, {
              type: currentStyle,
              position: currentStyle === 1 ? style1Position.position : currentStyle === 2 ? style2Position.position : currentStyle === 3 ? style3Position.position : style4Position.position,
              offset: currentStyle === 1 ? style1Position.offset : currentStyle === 2 ? style2Position.offset : currentStyle === 3 ? style3Position.offset : style4Position.offset
            }, canvas.width, canvas.height);
          }
        }
      }
    };
    
    drawCanvas();
  }, [hooks, slideshowHooksPerImage, currentStyle, style1Position, style2Position, style3Position, style4Position]);

  // Calculer les images à afficher dans la preview (sélection déterministe)
  const previewImages = useMemo(() => {
    const images = [];
    
    for (let i = 0; i < slideshowImageCount; i++) {
      let imageUrl = null;
      
      if (selectedCollection && selectedCollection.images?.length > 0) {
        // Mode "One for all" - prendre des images de façon cyclique
        const imageIndex = i % selectedCollection.images.length;
        imageUrl = selectedCollection.images[imageIndex]?.url;
      } else if (selectedCollectionsByPosition[i] && selectedCollectionsByPosition[i].images?.length > 0) {
        // Mode "One per position" - première image de chaque collection
        const collection = selectedCollectionsByPosition[i];
        imageUrl = collection.images[0]?.url;
      } else if (selectedMultipleCollections.length > 0) {
        // Mode "Multiple Collections" - cycler à travers toutes les collections
        const allImages = selectedMultipleCollections.flatMap(collection => collection.images || []);
        if (allImages.length > 0) {
          const imageIndex = i % allImages.length;
          imageUrl = allImages[imageIndex]?.url;
        }
      }
      
      images.push(imageUrl);
    }
    
    return images;
  }, [slideshowImageCount, selectedCollection, selectedCollectionsByPosition, selectedMultipleCollections]);

  // Effet pour faire défiler les images des slideshows générés
  useEffect(() => {
    if (generationComplete && generatedSlideshows.length > 0) {
      const interval = setInterval(() => {
        setSlideshowImageIndexes(prev => {
          const newIndexes = { ...prev };
          generatedSlideshows.slice(0, 5).forEach((slideshowId, index) => {
            // Utiliser slideshowId comme clé au lieu de index
            const currentIndex = prev[slideshowId] || 0;
            const images = generatedSlideshowsImages[slideshowId] || [];
            if (images.length > 0) {
              newIndexes[slideshowId] = (currentIndex + 1) % images.length;
            }
          });
          return newIndexes;
        });
      }, 2000); // Changer d'image toutes les 2 secondes

      return () => clearInterval(interval);
    }
  }, [generationComplete, generatedSlideshows, generatedSlideshowsImages]);

  // Effet pour faire tourner les images dans la preview
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPreviewIndex((prev) => (prev + 1) % slideshowImageCount);
    }, 2000); // Change toutes les 2 secondes

    return () => clearInterval(interval);
  }, [slideshowImageCount]);


  // Charger les collections d'images de l'utilisateur depuis Supabase
  useEffect(() => {
    if (!user?.id) return;
    
    const loadCollections = async () => {
      try {
        const { getImageCollections } = await import('@/lib/collections-db');
        const collections = await getImageCollections(user.id);
        setImageCollections(collections);
      } catch (e) {
        console.error('Error loading collections from Supabase:', e);
        setImageCollections([]);
      }
    };
    
    loadCollections();
  }, [user?.id]);

  // Fonction pour calculer le nombre de combinaisons
  const getSlideshowCombinationCount = (): number => {
    // Vérifier qu'on a des images sélectionnées
    let totalAvailableImages = 0;
    
    if (selectedCollection && selectedCollection.images) {
      // Mode "One for all"
      totalAvailableImages = selectedCollection.images.length;
    } else if (selectedMultipleCollections.length > 0) {
      // Mode "Multiple Collections" - basé sur la collection avec le moins d'images
      const validCollections = selectedMultipleCollections.filter(c => c.images && c.images.length > 0);
      if (validCollections.length === 0) return 0;
      
      // Prendre la collection avec le moins d'images
      const minImages = Math.min(...validCollections.map(c => c.images!.length));
      totalAvailableImages = minImages;
    } else if (Object.keys(selectedCollectionsByPosition).length > 0) {
      // Mode "Per position" - on calcule le produit des possibilités
      let combinations = 1;
      for (let i = 0; i < slideshowImageCount; i++) {
        const collection = selectedCollectionsByPosition[i];
        if (collection && collection.images && collection.images.length > 0) {
          combinations *= collection.images.length;
        }
      }
      
      // Calculer aussi les hooks
      const hooksCount = Object.keys(slideshowHooksPerImage).reduce((total, key) => {
        const hooks = slideshowHooksPerImage[parseInt(key)];
        if (hooks && hooks.trim()) {
          const hookLines = hooks.split('\n').filter(line => line.trim() !== '');
          return total * Math.max(1, hookLines.length);
        }
        return total;
      }, 1);
      
      return Math.min(combinations * Math.max(1, hooksCount), 1000000); // Limiter à 1 million
    }
    
    if (totalAvailableImages === 0) return 0;
    
    // Calculer les variations de hooks
    const hooksCount = Object.keys(slideshowHooksPerImage).reduce((total, key) => {
      const hooks = slideshowHooksPerImage[parseInt(key)];
      if (hooks && hooks.trim()) {
        const hookLines = hooks.split('\n').filter(line => line.trim() !== '');
        return total * Math.max(1, hookLines.length);
      }
      return total;
    }, 1);
    
    // Calculer les permutations pour tous les modes
    const availableImages = Math.min(totalAvailableImages, slideshowImageCount);
    if (availableImages === 0) return 0;
    
    let permutations = 1;
    
    if (slideshowUploadMode === 'ordered') {
      // Mode ordered : Combinaisons (ordre ne compte pas)
      // C(n,k) = n! / (k! * (n-k)!)
      // Mais on simplifie en calculant juste les possibilités
      if (totalAvailableImages >= slideshowImageCount) {
        // On peut faire beaucoup de combinaisons différentes
        for (let i = 0; i < slideshowImageCount; i++) {
          permutations *= (totalAvailableImages - i);
        }
        // Diviser par factorielle pour avoir les combinaisons
        let factorial = 1;
        for (let i = 2; i <= slideshowImageCount; i++) {
          factorial *= i;
        }
        permutations = Math.floor(permutations / factorial);
      }
    } else {
      // Mode random : Permutations (ordre compte)
      for (let i = 0; i < slideshowImageCount && i < availableImages; i++) {
        permutations *= (availableImages - i);
      }
    }
    
    // Limiter à 1 million pour éviter les nombres trop grands
    return Math.min(permutations * Math.max(1, hooksCount), 1000000);
  };

  const handleImageDrop = (files: File[], index?: number) => {
    if (index !== undefined) {
      // Mode ordonné - image spécifique
      setSlideshowImages(prev => {
        const newImages = [...prev];
        newImages[index] = files[0];
        return newImages;
      });
    } else {
      // Mode aléatoire - toutes les images
      setSlideshowImages(files.slice(0, slideshowImageCount));
    }
  };

  // Fonction pour obtenir les images pour un slideshow avec des combinaisons vraiment aléatoires
  const getImagesForSlideshow = (slideshowIndex: number): string[] => {
    const images: string[] = [];
    
    // Mode "Multiple Collections" - Utiliser la collection correspondante
    if (collectionMode === 'multiple-collections' && selectedMultipleCollections.length > 0) {
      const collectionIndex = Math.floor(slideshowIndex / slideshowsToCreate);
      const collection = selectedMultipleCollections[collectionIndex % selectedMultipleCollections.length];
      
      if (collection && collection.images && collection.images.length > 0) {
        const availableImages = [...collection.images];
        
        // Mélanger complètement le tableau pour avoir une vraie randomisation
        for (let i = availableImages.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [availableImages[i], availableImages[j]] = [availableImages[j], availableImages[i]];
        }
        
        // Prendre les N premières images du tableau mélangé
        for (let pos = 0; pos < slideshowImageCount; pos++) {
          if (pos < availableImages.length) {
            images.push(availableImages[pos].url);
          } else {
            // Si on a moins d'images que nécessaire, recommencer depuis le début
            images.push(availableImages[pos % availableImages.length].url);
          }
        }
      }
    } else if (selectedCollection && selectedCollection.images && selectedCollection.images.length > 0) {
      // Mode "One for all" - Sélectionner aléatoirement parmi TOUTES les images
      const availableImages = [...selectedCollection.images];
      
      // Mélanger complètement le tableau pour avoir une vraie randomisation
      for (let i = availableImages.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableImages[i], availableImages[j]] = [availableImages[j], availableImages[i]];
      }
      
      // Prendre les N premières images du tableau mélangé
      for (let pos = 0; pos < slideshowImageCount; pos++) {
        if (pos < availableImages.length) {
          images.push(availableImages[pos].url);
        } else {
          // Si on a moins d'images que nécessaire, recommencer depuis le début
          images.push(availableImages[pos % availableImages.length].url);
        }
      }
    } else {
      // Mode "One per position" - Une collection différente pour chaque position
      for (let pos = 0; pos < slideshowImageCount; pos++) {
        const collection = selectedCollectionsByPosition[pos];
        
        if (collection && collection.images && collection.images.length > 0) {
          // Sélection vraiment aléatoire pour chaque position
          const randomIndex = Math.floor(Math.random() * collection.images.length);
          images.push(collection.images[randomIndex].url);
        }
      }
    }
    
    return images;
  };

  // Fonction pour créer les slideshows
  const handleCreateSlideshows = async () => {
    try {
      // Debug logs pour comprendre l'état des hooks
      console.log('=== SLIDESHOW CREATION DEBUG ===');
      console.log('Hook mode:', hookMode);
      console.log('Main hooks text:', hooks);
      console.log('Hooks per image:', slideshowHooksPerImage);
      console.log('Hook mode state:', hookMode);
      console.log('================================');
      
      // Vérifier qu'on a tout ce qu'il faut
      if (!selectedCollection && Object.keys(selectedCollectionsByPosition).length === 0 && selectedMultipleCollections.length === 0) {
        toast.error('Please select image collections first. Go to the Images page to create and manage your collections.');
        return;
      }
      
      // Check if the collections have images
      if (selectedCollection) {
        if (!selectedCollection.images || selectedCollection.images.length === 0) {
          toast.error('The selected collection has no images. Please add images to the collection first.');
          return;
        }
      } else if (selectedMultipleCollections.length > 0) {
        // Check multiple collections
        const hasAnyImages = selectedMultipleCollections.some(
          (col: any) => col?.images && col.images.length > 0
        );
        if (!hasAnyImages) {
          toast.error('None of the selected collections have images. Please add images to your collections first.');
          return;
        }
      } else if (Object.keys(selectedCollectionsByPosition).length > 0) {
        // Check per-position collections
        const hasAnyImages = Object.values(selectedCollectionsByPosition).some(
          (col: any) => col?.images && col.images.length > 0
        );
        if (!hasAnyImages) {
          toast.error('None of the selected collections have images. Please add images to your collections first.');
          return;
        }
      }
      
      // Vérifier les hooks - soit le hook principal, soit les hooks par image
      const hasMainHook = hooks && hooks.trim();
      const hasImageHooks = Object.values(slideshowHooksPerImage).some(h => h && h.trim());
      if (!hasMainHook && !hasImageHooks) {
        toast.error('Please enter at least one hook');
        return;
      }
      
      // Ajuster le nombre de slideshows selon le mode
      let actualSlideshowsToCreate = slideshowsToCreate;
      
      // Calculer le nombre de slideshows à créer selon le mode
      if (collectionMode === 'multiple-collections' && selectedMultipleCollections.length > 0) {
        // Mode Multiple Collections - toujours utiliser le "Number to create" choisi
        actualSlideshowsToCreate = slideshowsToCreate * selectedMultipleCollections.length;
        toast.info(`Creating ${actualSlideshowsToCreate} slideshows (${slideshowsToCreate} per collection × ${selectedMultipleCollections.length} collections)`);
      }
      // Note: Removed automatic hook lines detection to respect user's "Number to create" setting
      
      setIsGenerating(true);
      setProgress(0);
      setGeneratedSlideshows([]);
      setGeneratedSlideshowsImages({});
      setSlideshowImageIndexes({});
      setGeneratedCount(0);
      setTotalToGenerate(actualSlideshowsToCreate);
      
      const generatedUrls: string[] = [];
      const allGeneratedImages: {[key: string]: string[]} = {};
      
      for (let i = 0; i < actualSlideshowsToCreate; i++) {
        try {
          // Calculer le progrès
          const currentProgress = Math.round(((i + 1) / actualSlideshowsToCreate) * 100);
          setProgress(currentProgress);
          setGeneratedCount(i + 1);
          
          // Obtenir les images pour ce slideshow
          const images = getImagesForSlideshow(i); // Passer l'index direct pour le mode Multiple Collections
          
          if (images.length === 0) {
            toast.error(`No images available for slideshow ${i + 1}. Please go to Images page to create collections first.`);
            continue;
          }
          
          // Filter out any null/undefined images
          const validImages = images.filter(img => img && typeof img === 'string');
          if (validImages.length === 0) {
            toast.error(`No valid image URLs for slideshow ${i + 1}`);
            continue;
          }
          
          // Préparer les hooks pour ce slideshow
          let hooksToSend: any[] = [];
          
          console.log(`Processing slideshow ${i + 1} - Hook mode: ${hookMode}`);
          console.log('Main hooks text:', JSON.stringify(hooks));
          console.log('Hooks per image:', JSON.stringify(slideshowHooksPerImage));
          
          if (hookMode === 'first') {
            // Mode "Hook only first image"
            console.log('Processing FIRST mode');
            if (hooks && hooks.trim()) {
              console.log('Hooks text exists:', JSON.stringify(hooks));
              const allHookLines = hooks.split('\n').filter(line => line.trim());
              console.log('Hook lines found:', allHookLines);
              if (allHookLines.length > 0) {
                // Sélection aléatoire des hooks pour éviter la répétition
                const randomSeed = Date.now() + i * 9973 + Math.random() * 10000;
                const randomIndex = Math.floor((Math.sin(randomSeed * 0.001) * 10000) % allHookLines.length);
                const hookIndex = Math.abs(randomIndex);
                hooksToSend = [allHookLines[hookIndex]];
                console.log(`🎲 Slideshow ${i + 1} random selection: seed=${randomSeed}, index=${hookIndex}/${allHookLines.length}`);
                console.log(`🎯 Selected hook: "${allHookLines[hookIndex]}"`);
              } else {
                console.log('No valid hook lines found');
              }
            } else {
              console.log('No hooks text provided');
            }
          } else if (hookMode === 'each') {
            // Mode "Hook per each image" 
            console.log('Processing EACH mode');
            hooksToSend = Object.entries(slideshowHooksPerImage)
              .map(([position, hookText]) => ({
                position: parseInt(position),
                text: hookText
              }))
              .filter(h => h.text && h.text.trim());
            console.log(`Slideshow ${i + 1} will use per-image hooks:`, hooksToSend);
          } else {
            console.log('No hook mode matched - staying empty');
          }
          
          console.log(`Final hooks to send for slideshow ${i + 1}:`, JSON.stringify(hooksToSend));
          
          // Récupérer le token d'authentification
          const { data } = await supabase?.auth.getSession?.() ?? {};
          const session = data?.session;
          
          // Préparer les données à envoyer
          const requestData = {
            images: validImages,
            hooks: hooksToSend,
            style: currentStyle,
            imageCount: slideshowImageCount,
            positions: {
              style1: style1Position,
              style2: style2Position,
              style3: style3Position
            }
          };

          console.log('=== SENDING TO API ===');
          console.log('Request data:', JSON.stringify(requestData, null, 2));
          console.log('=====================');

          // Appeler l'API pour créer le slideshow
          const response = await fetch('/api/create-slideshow', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` })
            },
            body: JSON.stringify(requestData)
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            throw new Error(errorData.error || 'Failed to create slideshow');
          }
          
          const result = await response.json();
          
          // Store the slideshow ID and the ORIGINAL images used (not the generated paths)
          if (result.slideshowId) {
            const slideshowId = result.slideshowId;
            generatedUrls.push(slideshowId);
            // Store the ORIGINAL images that were sent to the API
            allGeneratedImages[slideshowId] = validImages;
            console.log(`Stored images for slideshow ${slideshowId}:`, validImages);
            
            // Store hook metadata if needed for display
            if (result.hookText) {
              console.log('Slideshow created with hook:', result.hookText, 'Style:', result.hookStyle);
            }
          } else {
            throw new Error('No slideshow ID returned');
          }
          
          
        } catch (error: any) {
          console.error(`Error creating slideshow ${i + 1}:`, error);
          toast.error(`Failed to create slideshow ${i + 1}: ${error.message}`);
        }
      }
      
      if (generatedUrls.length > 0) {
        // Mettre à jour l'état avec les slideshows générés et les images
        setGeneratedSlideshows(generatedUrls);
        setGeneratedSlideshowsImages(allGeneratedImages);
        console.log('Final allGeneratedImages:', allGeneratedImages);
        
        // Sauvegarder les slideshows générés dans localStorage avec les images générées par l'API
        if (user?.id) {
          const existingSlideshows = JSON.parse(localStorage.getItem(`generated-slideshows-${user.id}`) || '[]');
          const newSlideshows = generatedUrls.map(slideshowId => {
            // Pour le localStorage, on utilise les chemins générés par l'API
            const generatedPaths = [];
            for (let j = 1; j <= slideshowImageCount; j++) {
              generatedPaths.push(`/generated-slideshows/${slideshowId}/part_${j}.png`);
            }
            return {
              id: slideshowId,
              images: generatedPaths, // Les chemins vers les images générées
              originalImages: allGeneratedImages[slideshowId] || [], // Les images originales
              createdAt: new Date().toISOString(),
              name: `Slideshow ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`
            };
          });
          localStorage.setItem(`generated-slideshows-${user.id}`, JSON.stringify([...existingSlideshows, ...newSlideshows]));
        }
        
        // Génération terminée avec succès
        setProgress(100);
        setGenerationComplete(true);
        toast.success(`${generatedUrls.length} slideshow${generatedUrls.length > 1 ? 's' : ''} generated successfully!`);
      } else {
        toast.error('No slideshows were generated');
      }
      
    } catch (error) {
      console.error('Error generating slideshows:', error);
      toast.error('An error occurred while generating slideshows');
    } finally {
      setIsGenerating(false);
    }
  };

  // Fonctions temporaires pour éviter les erreurs (peuvent être supprimées si non utilisées)
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = (song: any) => {
    // Fonction temporaire vide
  };
  
  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f3f4f0' }}>
      <div className="px-4 xl:px-6 pt-4" suppressHydrationWarning>
        <div suppressHydrationWarning>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold" style={{ color: '#333333' }}>Create Slideshow</h1>
          </div>
          
          <div className="flex flex-col space-y-6 mb-8">
            <div className="flex justify-between items-center">
            </div>
            <div className="flex flex-row h-[calc(100vh-100px)] rounded-2xl border border-[#d0d0ce]" style={{ backgroundColor: '#e6e6e1' }}>
              {/* Left Panel - Steps */}
              <div className="w-[calc(100%-250px)] sm:flex-1 overflow-y-auto">
                <div className="p-3 space-y-4">
                  
                  {/* Configuration Section */}
                  {/* Reorganized sections - Images first, then Hooks, Configuration, Music */}
                  <div className="grid grid-cols-1 [@media(min-width:1000px)]:grid-cols-2 gap-4">
                    {/* Images Section (moved to step 1) */}
                  <section className="space-y-2 bg-[#f3f4f0] dark:bg-[#0e0f15] p-3 rounded-lg border border-[#d2d2d0]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">1</div>
                        <h2 className="text-base font-bold dark:text-white">Images</h2>
                      </div>
                    </div>
                    
                    {/* Select Collection Button */}
                    {!selectedCollection && Object.keys(selectedCollectionsByPosition).length === 0 && selectedMultipleCollections.length === 0 && (
                      <div className="mb-3">
                        <button
                          onClick={() => {
                            setShowCollectionModal(true);
                            setCurrentSelectionStep(0);
                          }}
                          className="px-4 py-2 text-sm font-medium rounded-lg bg-[#3e90fd] text-white hover:bg-[#3e90fd]/90 transition-colors w-full"
                        >
                          Select Collection
                        </button>
                      </div>
                    )}
                    
                    {selectedCollection ? (
                      // One collection for all selected
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600">
                            Mode: <span className="font-medium">One for all</span> • Collection: <span className="font-medium">{selectedCollection.name}</span>
                          </p>
                          <button
                            onClick={() => setSelectedCollection(null)}
                            className="text-xs text-red-500 hover:text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="flex gap-2">
                          {selectedCollection.images && selectedCollection.images.length > 0 ? (
                            <>
                              {selectedCollection.images.slice(0, 5).map((image: any, index: number) => (
                                <div key={index} className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                                  <img 
                                    src={image.url} 
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                              {selectedCollection.images.length > 5 && (
                                <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                                  <span className="text-xs text-gray-600 font-medium">
                                    +{selectedCollection.images.length - 5}
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="h-16 bg-gray-100 rounded-lg flex items-center justify-center px-4">
                              <p className="text-xs text-gray-500">
                                No images in collection
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : Object.keys(selectedCollectionsByPosition).length > 0 ? (
                      // Multiple collections per position
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600">
                            Mode: <span className="font-medium">One per position</span>
                          </p>
                          <button
                            onClick={() => setSelectedCollectionsByPosition({})}
                            className="text-xs text-red-500 hover:text-red-600"
                          >
                            Clear all
                          </button>
                        </div>
                        <div className="space-y-2">
                          {Array.from({ length: slideshowImageCount }, (_, index) => {
                            const collection = selectedCollectionsByPosition[index];
                            return (
                              <div key={index} className="p-2 bg-gray-50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-medium">Position {index + 1}</p>
                                  {collection ? (
                                    <p className="text-xs truncate max-w-[100px]">{collection.name}</p>
                                  ) : (
                                    <p className="text-xs text-gray-400">Not selected</p>
                                  )}
                                </div>
                                {collection && collection.images && collection.images.length > 0 && (
                                  <div className="flex gap-1">
                                    {collection.images.slice(0, 5).map((img: any, imgIndex: number) => (
                                      <div key={imgIndex} className="w-10 h-10 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                                        <img 
                                          src={img.url} 
                                          alt=""
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    ))}
                                    {collection.images.length > 5 && (
                                      <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                                        <span className="text-[10px] text-gray-600 font-medium">
                                          +{collection.images.length - 5}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : selectedMultipleCollections.length > 0 ? (
                      // Multiple collections selected
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600">
                            Mode: <span className="font-medium">Multiple Collections</span> • 
                            <span className="font-medium">{selectedMultipleCollections.length} collections</span> • 
                            <span className="font-medium text-green-600">{slideshowsToCreate * selectedMultipleCollections.length} slideshows total</span>
                          </p>
                          <button
                            onClick={() => setSelectedMultipleCollections([])}
                            className="text-xs text-red-500 hover:text-red-600"
                          >
                            Clear all
                          </button>
                        </div>
                        <div className="space-y-2">
                          {selectedMultipleCollections.map((collection) => (
                            <div key={collection.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                              <div className="flex gap-1 flex-1">
                                {collection.images && collection.images.slice(0, 4).map((img: any, idx: number) => (
                                  <div key={idx} className="w-12 h-12 rounded overflow-hidden bg-gray-100">
                                    <img 
                                      src={img.url} 
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ))}
                                {collection.images && collection.images.length > 4 && (
                                  <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center">
                                    <span className="text-xs text-gray-600 font-medium">
                                      +{collection.images.length - 4}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">{collection.name}</p>
                                <p className="text-xs text-gray-500">{collection.images?.length || 0} images</p>
                              </div>
                              <button
                                onClick={() => setSelectedMultipleCollections(prev => prev.filter(c => c.id !== collection.id))}
                                className="text-red-500 hover:text-red-600 p-1"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </section>

                    {/* Hooks Section (stays as step 2) */}
                    <section className="space-y-2 bg-[#f3f4f0] dark:bg-[#0e0f15] p-3 rounded-lg border border-[#d2d2d0]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">2</div>
                          <h2 className="text-base font-bold dark:text-white">Hooks</h2>
                        </div>
                      </div>
                      
                      {/* Mode selection */}
                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => {
                            setHookMode('first');
                            setSlideshowHooksPerImage({}); // Clear per-image hooks when switching to first mode
                          }}
                          className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                            hookMode === 'first'
                              ? 'bg-[#3e90fd] text-white'
                              : 'bg-transparent text-[#383838] border border-[#b8b8b8] hover:bg-gray-50'
                          }`}
                        >
                          Hook only on first image
                        </button>
                        <button
                          onClick={() => {
                            setHookMode('each');
                            setHooks(''); // Clear main hooks when switching to each mode
                          }}
                          className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                            hookMode === 'each'
                              ? 'bg-[#3e90fd] text-white'
                              : 'bg-transparent text-[#383838] border border-[#b8b8b8] hover:bg-gray-50'
                          }`}
                        >
                          Hook per each image
                        </button>
                      </div>
                      
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {hookMode === 'first' ? (
                          // Mode: Un seul hook pour la première image
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="block text-sm font-medium" style={{ color: '#333333' }}>
                                Hook only on first image
                              </label>
                              <input
                                type="file"
                                accept=".txt"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (e) => {
                                      const content = e.target?.result as string;
                                      setHooks(content.trim());
                                    };
                                    reader.readAsText(file);
                                  }
                                }}
                                className="hidden"
                                id="hook-file-first"
                              />
                              <label
                                htmlFor="hook-file-first"
                                className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Load
                              </label>
                            </div>
                            <Textarea
                              value={hooks}
                              onChange={(e) => {
                                setHooks(e.target.value);
                              }}
                              placeholder="Enter your hook text here..."
                              className="min-h-[100px] text-sm"
                              style={{ 
                                backgroundColor: 'white', 
                                color: '#1e1e1e',
                                borderColor: '#d0d0ce'
                              }}
                            />
                            
                            <div className="flex gap-2 mt-4">
                              <div
                                onClick={() => {
                                  setSelectedStyles(new Set([1]));
                                  setCurrentStyle(1);
                                }}
                                className={`flex-1 flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all ${
                                  selectedStyles.has(1)
                                    ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd]"
                                    : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                                }`}
                              >
                                <div 
                                  className={`text-sm font-semibold ${
                                    selectedStyles.has(1) 
                                      ? "text-white dark:text-white" 
                                      : "text-gray-700 dark:text-white"
                                  }`}
                                >
                                  Normal
                                </div>
                              </div>
                              <div
                                onClick={() => {
                                  setSelectedStyles(new Set([2]));
                                  setCurrentStyle(2);
                                }}
                                className={`flex-1 flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all ${
                                  selectedStyles.has(2)
                                    ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd]"
                                    : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                                }`}
                              >
                                <div 
                                  className={`text-sm font-semibold ${
                                    selectedStyles.has(2) 
                                      ? "text-white dark:text-white" 
                                      : "text-gray-700 dark:text-white"
                                  }`}
                                >
                                  White
                                </div>
                              </div>
                              
                              <div
                                onClick={() => {
                                  setSelectedStyles(new Set([3]));
                                  setCurrentStyle(3);
                                }}
                                className={`flex-1 flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all ${
                                  selectedStyles.has(3)
                                    ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd]"
                                    : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                                }`}
                              >
                                <div 
                                  className={`text-sm font-semibold ${
                                    selectedStyles.has(3) 
                                      ? "text-white dark:text-white" 
                                      : "text-gray-700 dark:text-white"
                                  }`}
                                >
                                  Black
                                </div>
                              </div>
                              
                              <div
                                onClick={() => {
                                  setSelectedStyles(new Set([4]));
                                  setCurrentStyle(4);
                                }}
                                className={`flex-1 flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all ${
                                  selectedStyles.has(4)
                                    ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd]"
                                    : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                                }`}
                              >
                                <div 
                                  className={`text-sm font-semibold ${
                                    selectedStyles.has(4) 
                                      ? "text-white dark:text-white" 
                                      : "text-gray-700 dark:text-white"
                                  }`}
                                >
                                  Normal New
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Mode: Un hook par image avec bouton Load à droite de chaque image
                          <div className="space-y-4">
                            {Array.from({ length: slideshowImageCount }, (_, index) => (
                              <div key={index} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="block text-sm font-medium" style={{ color: '#333333' }}>
                                    Image {index + 1}
                                  </label>
                                  <input
                                    type="file"
                                    accept=".txt"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (e) => {
                                          const content = e.target?.result as string;
                                          setSlideshowHooksPerImage(prev => ({
                                            ...prev,
                                            [index]: content.trim()
                                          }));
                                        };
                                        reader.readAsText(file);
                                      }
                                    }}
                                    className="hidden"
                                    id={`hook-file-${index}`}
                                  />
                                  <label
                                    htmlFor={`hook-file-${index}`}
                                    className="px-3 py-1.5 bg-transparent text-[#383838] border border-[#b8b8b8] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2 text-sm font-normal"
                                  >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5M12 3v12M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    Load
                                  </label>
                                </div>
                                <Textarea
                                  value={slideshowHooksPerImage[index] || ''}
                                  onChange={(e) => {
                                    setSlideshowHooksPerImage(prev => ({
                                      ...prev,
                                      [index]: e.target.value
                                    }));
                                  }}
                                  placeholder="Enter hooks, one per line..."
                                  className="min-h-[60px] text-sm"
                                  style={{ 
                                    backgroundColor: 'white', 
                                    color: '#1e1e1e',
                                    borderColor: '#d0d0ce'
                                  }}
                                />
                              </div>
                            ))}
                            
                            {/* Hook Style Selection - same as first image mode */}
                            <div className="flex gap-2 mt-4">
                              <div
                                onClick={() => {
                                  setSelectedStyles(new Set([1]));
                                  setCurrentStyle(1);
                                }}
                                className={`flex-1 flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all ${
                                  selectedStyles.has(1)
                                    ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd]"
                                    : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                                }`}
                              >
                                <div 
                                  className={`text-sm font-semibold ${
                                    selectedStyles.has(1) 
                                      ? "text-white dark:text-white" 
                                      : "text-gray-700 dark:text-white"
                                  }`}
                                >
                                  Normal
                                </div>
                              </div>
                              <div
                                onClick={() => {
                                  setSelectedStyles(new Set([2]));
                                  setCurrentStyle(2);
                                }}
                                className={`flex-1 flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all ${
                                  selectedStyles.has(2)
                                    ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd]"
                                    : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                                }`}
                              >
                                <div 
                                  className={`text-sm font-semibold ${
                                    selectedStyles.has(2) 
                                      ? "text-white dark:text-white" 
                                      : "text-gray-700 dark:text-white"
                                  }`}
                                >
                                  White
                                </div>
                              </div>
                              
                              <div
                                onClick={() => {
                                  setSelectedStyles(new Set([3]));
                                  setCurrentStyle(3);
                                }}
                                className={`flex-1 flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all ${
                                  selectedStyles.has(3)
                                    ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd]"
                                    : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                                }`}
                              >
                                <div 
                                  className={`text-sm font-semibold ${
                                    selectedStyles.has(3) 
                                      ? "text-white dark:text-white" 
                                      : "text-gray-700 dark:text-white"
                                  }`}
                                >
                                  Black
                                </div>
                              </div>
                              
                              <div
                                onClick={() => {
                                  setSelectedStyles(new Set([4]));
                                  setCurrentStyle(4);
                                }}
                                className={`flex-1 flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all ${
                                  selectedStyles.has(4)
                                    ? "bg-[#3e90fd] text-white dark:bg-[#3e90fd]"
                                    : "bg-[#e6e6e1] hover:bg-[#e6e6e1] dark:bg-[#18181a] dark:hover:bg-[#18191C] dark:text-white"
                                }`}
                              >
                                <div 
                                  className={`text-sm font-semibold ${
                                    selectedStyles.has(4) 
                                      ? "text-white dark:text-white" 
                                      : "text-gray-700 dark:text-white"
                                  }`}
                                >
                                  Normal New
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>

                  {/* Configuration Section (moved to step 3) */}
                  <section className="space-y-2 bg-[#f3f4f0] dark:bg-[#0e0f15] p-3 rounded-lg border border-[#d2d2d0]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fafafa] text-[#0a0a0c] font-bold text-sm border border-[#b8b8b8] dark:border-[#18181a]">3</div>
                          <h2 className="text-base font-bold dark:text-white">Configuration</h2>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: '#333333' }}>
                            Number of images
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={slideshowImageCount}
                            onChange={(e) => setSlideshowImageCount(parseInt(e.target.value) || 1)}
                            className="w-20 px-3 py-2 border border-[#d0d0ce] rounded-lg text-sm"
                            style={{ backgroundColor: 'white', color: '#1e1e1e' }}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: '#333333' }}>
                            Number to create
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={getSlideshowCombinationCount()}
                            value={slideshowsToCreate}
                            onChange={(e) => setSlideshowsToCreate(Math.max(1, Math.min(
                              getSlideshowCombinationCount(),
                              parseInt(e.target.value) || 1
                            )))}
                            className="w-20 px-3 py-2 border border-[#d0d0ce] rounded-lg text-sm"
                            style={{ backgroundColor: 'white', color: '#1e1e1e' }}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Max: {getSlideshowCombinationCount().toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </section>

                  {/* Create Button */}
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={handleCreateSlideshows}
                      disabled={(!selectedCollection && Object.keys(selectedCollectionsByPosition).length === 0 && selectedMultipleCollections.length === 0)}
                      className="px-8 py-3 text-lg font-semibold text-white rounded-xl hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: '#f44e17' }}
                    >
                      Create {slideshowsToCreate} Slideshow{slideshowsToCreate > 1 ? 's' : ''}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right Panel - Preview */}
              <div className="w-[250px] sm:w-[250px] md:w-[300px] lg:w-[350px] xl:w-[400px] p-3 sm:p-4 xl:p-6 bg-[#e6e6e1] dark:bg-[#18181A] flex-col items-center justify-center border-l border-gray-200 dark:border-[#0e0f15] flex rounded-r-2xl">
                <div className="w-full max-w-[220px] md:max-w-[280px] xl:max-w-[320px]">
                  <div className="aspect-[9/16] rounded-2xl bg-[#e6e6e1] dark:bg-[#18181A] shadow-lg overflow-hidden relative">
                    {(selectedCollection?.images?.length > 0 || Object.keys(selectedCollectionsByPosition).length > 0 || selectedMultipleCollections.length > 0) ? (
                      <div className="w-full h-full relative">
                        {/* Affichage des images en rotation */}
                        {previewImages.map((imageUrl, index) => {
                          if (!imageUrl) return null;
                          
                          return (
                            <img
                              key={`preview-${index}`}
                              src={imageUrl}
                              alt={`Preview ${index + 1}`}
                              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                                index === currentPreviewIndex ? 'opacity-100' : 'opacity-0'
                              }`}
                            />
                          );
                        })}
                        
                        {/* Hook Canvas Overlay */}
                        <canvas
                          ref={canvasRef}
                          className="absolute inset-0 w-full h-full"
                          style={{ pointerEvents: 'none' }}
                        />
                        
                        {/* Indicateurs de position */}
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1">
                          {Array.from({ length: slideshowImageCount }, (_, index) => (
                            <div
                              key={index}
                              className={`w-1.5 h-1.5 rounded-full transition-all ${
                                index === currentPreviewIndex 
                                  ? 'bg-white w-4' 
                                  : 'bg-white/50'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <div className="text-center text-gray-500">
                          <div className="text-sm font-medium">Slideshow Preview</div>
                          <div className="text-xs">Select a collection to see preview</div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Text Position Controls */}
                  <div className="flex flex-col items-center gap-4 mt-2">
                    {/* Position Buttons */}
                    <div className="flex justify-center gap-2">
                      {/* Fine Position Control - Left of position buttons */}
                      <div className="flex gap-2 items-center mr-3">
                        <button
                          onClick={() => {
                            if (currentStyle === 1) {
                              setStyle1Position(prev => ({ ...prev, offset: Math.max(prev.offset - 5, -50) }));
                            } else if (currentStyle === 2) {
                              setStyle2Position(prev => ({ ...prev, offset: Math.max(prev.offset - 5, -50) }));
                            } else if (currentStyle === 3) {
                              setStyle3Position(prev => ({ ...prev, offset: Math.max(prev.offset - 5, -50) }));
                            } else {
                              setStyle4Position(prev => ({ ...prev, offset: Math.max(prev.offset - 5, -50) }));
                            }
                          }}
                          className="w-8 h-8 rounded-lg bg-[#e6e6e1] hover:bg-[#e6e6e1]/80 dark:bg-[#0e0f15] dark:hover:bg-[#18191C] dark:text-white flex items-center justify-center transition-all"
                          aria-label="Move text up"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 20V4m0 0l-6 6m6-6l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            if (currentStyle === 1) {
                              setStyle1Position(prev => ({ ...prev, offset: Math.min(prev.offset + 5, 50) }));
                            } else if (currentStyle === 2) {
                              setStyle2Position(prev => ({ ...prev, offset: Math.min(prev.offset + 5, 50) }));
                            } else if (currentStyle === 3) {
                              setStyle3Position(prev => ({ ...prev, offset: Math.min(prev.offset + 5, 50) }));
                            } else {
                              setStyle4Position(prev => ({ ...prev, offset: Math.min(prev.offset + 5, 50) }));
                            }
                          }}
                          className="w-8 h-8 rounded-lg bg-[#e6e6e1] hover:bg-[#e6e6e1]/80 dark:bg-[#0e0f15] dark:hover:bg-[#18191C] dark:text-white flex items-center justify-center transition-all"
                          aria-label="Move text down"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 4v16m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>

                      {/* Position Buttons */}
                      <button
                        onClick={() => {
                          if (currentStyle === 1) {
                            setStyle1Position({ position: 'top', offset: 0 });
                          } else if (currentStyle === 2) {
                            setStyle2Position({ position: 'top', offset: 0 });
                          } else if (currentStyle === 3) {
                            setStyle3Position({ position: 'top', offset: 0 });
                          } else {
                            setStyle4Position({ position: 'top', offset: 0 });
                          }
                        }}
                        className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
                          (currentStyle === 1 ? style1Position.position : currentStyle === 2 ? style2Position.position : currentStyle === 3 ? style3Position.position : style4Position.position) === 'top'
                            ? 'bg-[#3e90fd] text-[#fafafa] dark:bg-[#3e90fd] dark:text-[#fafafa]'
                            : 'bg-[#e6e6e1] hover:bg-[#e6e6e1]/80 dark:bg-[#0e0f15] dark:hover:bg-[#18191C] dark:text-white'
                        }`}
                      >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 5h16M4 9h16M10 13h4m-4 4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          if (currentStyle === 1) {
                            setStyle1Position({ position: 'middle', offset: 0 });
                          } else if (currentStyle === 2) {
                            setStyle2Position({ position: 'middle', offset: 0 });
                          } else if (currentStyle === 3) {
                            setStyle3Position({ position: 'middle', offset: 0 });
                          } else {
                            setStyle4Position({ position: 'middle', offset: 0 });
                          }
                        }}
                        className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
                          (currentStyle === 1 ? style1Position.position : currentStyle === 2 ? style2Position.position : currentStyle === 3 ? style3Position.position : style4Position.position) === 'middle'
                            ? 'bg-[#3e90fd] text-[#fafafa] dark:bg-[#3e90fd] dark:text-[#fafafa]'
                            : 'bg-[#e6e6e1] hover:bg-[#e6e6e1]/80 dark:bg-[#0e0f15] dark:hover:bg-[#18191C] dark:text-white'
                        }`}
                      >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 9h16M4 12h16M4 15h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          if (currentStyle === 1) {
                            setStyle1Position({ position: 'bottom', offset: 0 });
                          } else if (currentStyle === 2) {
                            setStyle2Position({ position: 'bottom', offset: 0 });
                          } else if (currentStyle === 3) {
                            setStyle3Position({ position: 'bottom', offset: 0 });
                          } else {
                            setStyle4Position({ position: 'bottom', offset: 0 });
                          }
                        }}
                        className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
                          (currentStyle === 1 ? style1Position.position : currentStyle === 2 ? style2Position.position : currentStyle === 3 ? style3Position.position : style4Position.position) === 'bottom'
                            ? 'bg-[#3e90fd] text-[#fafafa] dark:bg-[#3e90fd] dark:text-[#fafafa]'
                            : 'bg-[#e6e6e1] hover:bg-[#e6e6e1]/80 dark:bg-[#0e0f15] dark:hover:bg-[#18191C] dark:text-white'
                        }`}
                      >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10 7h4m-4 4h4M4 15h16M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>

                    {/* Test Hook button */}
                    <div className="flex gap-2 items-center">
                      {Object.values(slideshowHooksPerImage).some(h => h && h.trim()) && (
                        <Button
                          onClick={async () => {
                            try {
                              const firstHooks = slideshowHooksPerImage[0] || Object.values(slideshowHooksPerImage)[0] || '';
                              const lines = firstHooks.split('\n').filter(line => line.trim() !== '');
                              const hookText = lines[0] || '';
                              
                              // Ne pas créer de preview si le hook est vide
                              if (hookText.trim() === "") {
                                return;
                              }
                              
                              // Capturer directement le canvas de la preview
                              if (canvasRef.current) {
                                const canvas = canvasRef.current;
                                canvas.toBlob((blob) => {
                                  if (blob) {
                                    const url = URL.createObjectURL(blob);
                                    window.open(url, '_blank');
                                  }
                                });
                              }
                            } catch (error) {
                              console.error('Error creating hook preview:', error);
                            }
                          }}
                          className="bg-transparent border border-[#b8b8b8] text-[#383838] hover:bg-gray-50"
                          size="sm"
                        >
                          Test Hook
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de sélection des collections */}
      {showCollectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">
                {currentSelectionStep === 0 ? 'Select Collection Mode' : `Select Collection for Image ${currentSelectionStep}`}
              </h2>
              <button
                onClick={() => {
                  setShowCollectionModal(false);
                  setCurrentSelectionStep(0);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {currentSelectionStep === 0 ? (
              // Mode selection step
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => {
                      setCollectionMode('one-for-all');
                      setCurrentSelectionStep(1);
                    }}
                    className="p-6 border-2 border-gray-200 rounded-lg hover:border-[#3e90fd] transition-colors"
                  >
                    <h3 className="text-lg font-semibold mb-2">One for all</h3>
                    <p className="text-sm text-gray-600">Use the same collection for all {slideshowImageCount} images</p>
                  </button>
                  <button
                    onClick={() => {
                      setCollectionMode('per-position');
                      setSelectedCollectionsByPosition({});
                      setCurrentSelectionStep(1);
                    }}
                    className="p-6 border-2 border-gray-200 rounded-lg hover:border-[#3e90fd] transition-colors"
                  >
                    <h3 className="text-lg font-semibold mb-2">One per position</h3>
                    <p className="text-sm text-gray-600">Select different collections for each of the {slideshowImageCount} images</p>
                  </button>
                  <button
                    onClick={() => {
                      setCollectionMode('multiple-collections');
                      setSelectedMultipleCollections([]);
                      setCurrentSelectionStep(1);
                    }}
                    className="p-6 border-2 border-gray-200 rounded-lg hover:border-[#3e90fd] transition-colors"
                  >
                    <h3 className="text-lg font-semibold mb-2">Multiple Collections</h3>
                    <p className="text-sm text-gray-600">Select multiple collections. Create {slideshowsToCreate} slideshow{slideshowsToCreate > 1 ? 's' : ''} for each collection</p>
                  </button>
                </div>
              </div>
            ) : (
              // Collection selection
              <>
                {collectionMode === 'per-position' && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        Selecting for position {currentSelectionStep} of {slideshowImageCount}
                      </p>
                      <div className="flex gap-2">
                        {Array.from({ length: slideshowImageCount }, (_, i) => (
                          <div
                            key={i}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                              i + 1 === currentSelectionStep
                                ? 'bg-[#3e90fd] text-white'
                                : selectedCollectionsByPosition[i]
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {i + 1}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {collectionMode === 'multiple-collections' && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">
                      Select multiple collections. {selectedMultipleCollections.length} collection{selectedMultipleCollections.length !== 1 ? 's' : ''} selected.
                      {selectedMultipleCollections.length > 0 && ` Will create ${slideshowsToCreate * selectedMultipleCollections.length} total slideshows.`}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                  {imageCollections.length > 0 ? (
                    imageCollections
                      .slice((collectionModalPage - 1) * collectionsPerPage, collectionModalPage * collectionsPerPage)
                      .map((collection) => (
                      <div
                        key={collection.id}
                        onClick={() => {
                          if (collectionMode === 'multiple-collections') {
                            // Toggle selection for multiple mode
                            setSelectedMultipleCollections(prev => {
                              const isSelected = prev.some(c => c.id === collection.id);
                              if (isSelected) {
                                return prev.filter(c => c.id !== collection.id);
                              } else {
                                return [...prev, collection];
                              }
                            });
                          } else if (collectionMode === 'per-position') {
                            // Store selection for current position
                            setSelectedCollectionsByPosition(prev => ({
                              ...prev,
                              [currentSelectionStep - 1]: collection
                            }));
                            
                            // Move to next position or close
                            if (currentSelectionStep < slideshowImageCount) {
                              setCurrentSelectionStep(currentSelectionStep + 1);
                            } else {
                              setShowCollectionModal(false);
                              setCurrentSelectionStep(0);
                            }
                          } else {
                            // One for all mode
                            setSelectedCollection(collection);
                            setShowCollectionModal(false);
                            setCurrentSelectionStep(0);
                          }
                        }}
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                          collectionMode === 'multiple-collections' && selectedMultipleCollections.some(c => c.id === collection.id)
                            ? 'border-[#3e90fd] bg-blue-50'
                            : 'border-gray-200 hover:border-[#3e90fd]'
                        }`}
                      >
                    <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                      {collection.images && collection.images.length > 0 ? (
                        <div className="w-full h-full grid grid-cols-3 grid-rows-2 gap-0.5">
                          {/* First image - large, takes left 2/3 */}
                          {collection.images[0] && (
                            <div className="col-span-2 row-span-2">
                              <img 
                                src={collection.images[0].url} 
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          {/* Second image - top right */}
                          {collection.images[1] ? (
                            <div className="col-span-1 row-span-1">
                              <img 
                                src={collection.images[1].url} 
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="col-span-1 row-span-1 bg-gray-200"></div>
                          )}
                          {/* Third image - bottom right */}
                          {collection.images[2] ? (
                            <div className="col-span-1 row-span-1">
                              <img 
                                src={collection.images[2].url} 
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="col-span-1 row-span-1 bg-gray-200"></div>
                          )}
                          {/* Overlay for 4th and 5th images if they exist */}
                          {collection.images.length > 3 && (
                            <div className="absolute bottom-1 right-1 flex gap-1">
                              {collection.images[3] && (
                                <div className="w-6 h-6 rounded overflow-hidden border border-white/20">
                                  <img 
                                    src={collection.images[3].url} 
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              {collection.images[4] && (
                                <div className="w-6 h-6 rounded overflow-hidden border border-white/20">
                                  <img 
                                    src={collection.images[4].url} 
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No preview</span>
                      )}
                    </div>
                    <h3 className="font-medium text-sm mb-1">{collection.name}</h3>
                    <p className="text-xs text-gray-500">{collection.images?.length || 0} images</p>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <p className="text-gray-500">No image collections found</p>
                  <p className="text-xs text-gray-400 mt-2">Create collections in the Images page first</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {imageCollections.length > collectionsPerPage && (
              <div className="flex justify-center items-center gap-2 my-6">
                <button
                  onClick={() => setCollectionModalPage(prev => Math.max(1, prev - 1))}
                  disabled={collectionModalPage === 1}
                  className="px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-200 disabled:text-gray-400 bg-gray-100 hover:bg-gray-200"
                >
                  Previous
                </button>

                {Array.from({ length: Math.ceil(imageCollections.length / collectionsPerPage) }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCollectionModalPage(page)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      collectionModalPage === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCollectionModalPage(prev => Math.min(Math.ceil(imageCollections.length / collectionsPerPage), prev + 1))}
                  disabled={collectionModalPage === Math.ceil(imageCollections.length / collectionsPerPage)}
                  className="px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-200 disabled:text-gray-400 bg-gray-100 hover:bg-gray-200"
                >
                  Next
                </button>
              </div>
            )}
            </>
            )}

            {/* Modal Footer */}
            <div className="flex justify-between">
              <div>
                {collectionMode === 'per-position' && currentSelectionStep > 0 && (
                  <button
                    onClick={() => {
                      if (currentSelectionStep > 1) {
                        setCurrentSelectionStep(currentSelectionStep - 1);
                      } else {
                        setCurrentSelectionStep(0);
                      }
                    }}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Previous
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCollectionModal(false);
                    setCurrentSelectionStep(0);
                  }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                {collectionMode === 'per-position' && currentSelectionStep > 0 && (
                  <button
                    onClick={() => {
                      // Skip current position
                      if (currentSelectionStep < slideshowImageCount) {
                        setCurrentSelectionStep(currentSelectionStep + 1);
                      } else {
                        setShowCollectionModal(false);
                        setCurrentSelectionStep(0);
                      }
                    }}
                    className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Skip
                  </button>
                )}
                {collectionMode === 'multiple-collections' && (
                  <button
                    onClick={() => {
                      if (selectedMultipleCollections.length > 0) {
                        setShowCollectionModal(false);
                        setCurrentSelectionStep(0);
                        toast.success(`Selected ${selectedMultipleCollections.length} collections. Will create ${slideshowsToCreate * selectedMultipleCollections.length} slideshows total.`);
                      } else {
                        toast.error('Please select at least one collection');
                      }
                    }}
                    className="px-4 py-2 text-sm bg-[#3e90fd] text-white rounded-lg hover:bg-[#3e90fd]/90 disabled:opacity-50"
                    disabled={selectedMultipleCollections.length === 0}
                  >
                    Done ({selectedMultipleCollections.length} selected)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de génération */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-[#e6e6e1] dark:bg-[#18181a] rounded-lg shadow-xl p-8 max-w-md w-full mx-4 transform transition-all">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold dark:text-white">Generating Slideshows</h3>
                <p className="text-sm text-gray-500 dark:text-gray-300">Please wait while your slideshows are being created</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold text-[#5465ff]">{Math.round(progress)}%</span>
              </div>
            </div>
            
            <div className="relative w-full h-6 bg-gray-100 dark:bg-[#0e0f15] rounded-full overflow-hidden mb-4">
              <div
                className="absolute left-0 top-0 h-full bg-[#3e90fd] transition-all duration-300 rounded-full"
                style={{ 
                  width: `${progress}%`,
                  transition: 'width 0.5s ease-in-out'
                }}
              />
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300">
                {generatedCount} of {totalToGenerate} slideshows
              </span>
              <span className="text-gray-600 dark:text-gray-300">
                Processing...
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal de téléchargement */}
      {generationComplete && !isGenerating && generatedSlideshows.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-[#18181A] rounded-lg shadow-xl p-8 max-w-2xl w-full mx-4 border border-gray-700">
            <div className="flex flex-col items-center justify-center">
              <h3 className="text-2xl font-bold text-center mb-4 text-white">
                Your {generatedSlideshows.length} slideshow{generatedSlideshows.length > 1 ? 's are' : ' is'} ready!
              </h3>
              <p className="text-center text-gray-300 mb-6">What would you like to do next?</p>
              
              {/* Preview section - Afficher les slideshows avec les vraies images */}
              <div className="w-full mb-4">
                <div className="flex gap-3 justify-center flex-wrap">
                  {generatedSlideshows.slice(0, 5).map((slideshowId, index) => {
                    // Utiliser les vraies images originales qui ont été envoyées à l'API
                    const images = generatedSlideshowsImages[slideshowId] || [];
                    const currentImageIndex = slideshowImageIndexes[slideshowId] || 0;
                    
                    return (
                      <div key={slideshowId} className="relative">
                        <div className="aspect-[9/16] bg-black rounded-lg overflow-hidden w-[120px]">
                          {images.length > 0 ? (
                            <div className="relative w-full h-full">
                              {/* Afficher les vraies images avec transition */}
                              {images.map((imageUrl, imgIdx) => (
                                <img 
                                  key={imgIdx}
                                  src={imageUrl}
                                  alt={`Slideshow ${index + 1} - Image ${imgIdx + 1}`}
                                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                                    imgIdx === currentImageIndex ? 'opacity-100' : 'opacity-0'
                                  }`}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-900">
                              <div className="text-center">
                                <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p className="text-xs mt-1">#{index + 1}</p>
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-center text-xs text-gray-400 mt-1">Slideshow {index + 1}</p>
                        {images.length > 1 && (
                          <div className="flex justify-center gap-1 mt-1">
                            {images.map((_, imgIndex) => (
                              <div 
                                key={imgIndex}
                                className={`w-1 h-1 rounded-full ${
                                  imgIndex === currentImageIndex ? 'bg-white' : 'bg-gray-600'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Message si plus de 5 slideshows */}
                {generatedSlideshows.length > 5 && (
                  <p className="text-center text-sm text-gray-400 mt-2">
                    +{generatedSlideshows.length - 5} more slideshow{generatedSlideshows.length - 5 > 1 ? 's' : ''}
                  </p>
                )}
              </div>
              
              {/* Removed old navigation controls since we show multiple at once */}
              {false && generatedSlideshows.length > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-4">
                    <button
                      onClick={() => setCurrentGeneratedPreviewIndex(Math.max(0, currentGeneratedPreviewIndex - 1))}
                      disabled={currentGeneratedPreviewIndex === 0}
                      className="p-2 bg-gray-700 rounded-full disabled:opacity-50 text-white"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-white mx-4">
                      {currentGeneratedPreviewIndex + 1} / {generatedSlideshows.length}
                    </span>
                    <button
                      onClick={() => setCurrentGeneratedPreviewIndex(Math.min(generatedSlideshows.length - 1, currentGeneratedPreviewIndex + 1))}
                      disabled={currentGeneratedPreviewIndex === generatedSlideshows.length - 1}
                      className="p-2 bg-gray-700 rounded-full disabled:opacity-50 text-white"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                )}
              </div>
              
              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full mt-6">
                <button
                  onClick={async () => {
                    try {
                      // Préparer les slideshows pour le téléchargement
                      const slideshowsToDownload = generatedSlideshows.map((slideshowId, index) => ({
                        id: slideshowId,
                        images: generatedSlideshowsImages[slideshowId] || [],
                        name: `slideshow-${index + 1}`
                      }));
                      
                      // Télécharger tous les slideshows dans un ZIP
                      await downloadSlideshowsAsZip(slideshowsToDownload);
                      toast.success(`Downloaded ${generatedSlideshows.length} slideshow${generatedSlideshows.length > 1 ? 's' : ''}!`);
                    } catch (error) {
                      console.error('Error downloading slideshows:', error);
                      toast.error('Failed to download slideshows');
                    }
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-[#f8d4eb] via-[#ce7acb] to-[#e9bcba] text-[#0a0a0c] font-medium rounded-lg hover:opacity-90"
                >
                  Download All
                </button>
                <button
                  onClick={() => {
                    router.push('/generated-slideshows');
                  }}
                  className="flex-1 px-6 py-3 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600"
                >
                  View in Library
                </button>
                <button
                  onClick={() => {
                    setGenerationComplete(false);
                    setGeneratedSlideshows([]);
                    setGeneratedCount(0);
                    setCurrentGeneratedPreviewIndex(0);
                  }}
                  className="flex-1 px-6 py-3 border border-gray-600 text-gray-300 font-medium rounded-lg hover:bg-gray-700/50"
                >
                  Create More
                </button>
              </div>
            </div>
          </div>
      )}

      {/* Toast Container */}
      <ToastContainer position="top-right" />
    </div>
  );
}