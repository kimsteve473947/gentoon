import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { type CanvasRatio } from '@/types/editor';

// 패널 타입 정의
export interface Panel {
  id: string;
  prompt: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  isGenerating: boolean;
  generatedAt?: Date;
  tokensUsed?: number;
  style?: string;
  emotion?: string;
  characters?: string[];
}

// 캐릭터 타입 정의
export interface Character {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  aliases: string[];
  isActive: boolean;
  lastUsed?: Date;
}

// 프로젝트 타입 정의
export interface Project {
  id: string;
  name: string;
  description?: string;
  panels: Panel[];
  createdAt: Date;
  updatedAt: Date;
  isAutoSaving: boolean;
}

// 스튜디오 상태 타입
interface StudioState {
  // 프로젝트 관리
  currentProject: Project | null;
  projects: Project[];
  
  // 패널 관리
  panels: Panel[];
  activePanel: number | null;
  selectedPanels: number[];
  
  // 캐릭터 관리
  characters: Character[];
  activeCharacters: string[];
  
  // UI 상태
  sidebarCollapsed: boolean;
  canvasZoom: number;
  canvasGrid: boolean;
  canvasRatio: CanvasRatio;
  
  // 생성 상태
  isGenerating: boolean;
  generationQueue: string[];
  
  // 토큰 관리
  tokenBalance: number;
  
  // 편집기 상태
  promptText: string;
  selectedStyle: string;
  selectedEmotion: string;
}

// 스튜디오 액션 타입
interface StudioActions {
  // 프로젝트 액션
  createProject: (name: string, description?: string) => void;
  loadProject: (projectId: string) => void;
  saveProject: () => Promise<void>;
  renameProject: (name: string) => void;
  
  // 패널 액션
  addPanel: () => void;
  removePanel: (index: number) => void;
  duplicatePanel: (index: number) => void;
  reorderPanels: (fromIndex: number, toIndex: number) => void;
  selectPanel: (index: number) => void;
  selectMultiplePanels: (indices: number[]) => void;
  updatePanelPrompt: (index: number, prompt: string) => void;
  updatePanelImage: (index: number, imageUrl: string, thumbnailUrl?: string) => void;
  
  // 캐릭터 액션
  loadCharacters: () => Promise<void>;
  toggleCharacter: (characterId: string) => void;
  setActiveCharacters: (characterIds: string[]) => void;
  
  // 생성 액션
  generatePanel: (index: number, canvasRatio?: CanvasRatio) => Promise<void>;
  editPanel: (index: number, editPrompt: string, canvasRatio?: CanvasRatio) => Promise<void>;
  generateBatch: (indices: number[], canvasRatio?: CanvasRatio) => Promise<void>;
  cancelGeneration: () => void;
  
  // UI 액션
  toggleSidebar: () => void;
  setCanvasZoom: (zoom: number) => void;
  toggleGrid: () => void;
  
  // 편집기 액션
  setPromptText: (text: string) => void;
  setStyle: (style: string) => void;
  setEmotion: (emotion: string) => void;
  
  // 토큰 액션
  updateTokenBalance: (balance: number) => void;
}

// Zustand 스토어 생성
export const useStudioStore = create<StudioState & StudioActions>()(
  devtools(
    (set, get) => ({
      // 초기 상태
      currentProject: null,
      projects: [],
      panels: [
        {
          id: 'panel-1',
          prompt: '',
          isGenerating: false,
        }
      ],
      activePanel: 0,
      selectedPanels: [],
      characters: [],
      activeCharacters: [],
      sidebarCollapsed: false,
      canvasZoom: 1,
      canvasGrid: true,
      canvasRatio: '4:5',
      isGenerating: false,
      generationQueue: [],
      tokenBalance: 0,
      promptText: '',
      selectedStyle: 'korean_webtoon',
      selectedEmotion: 'neutral',

      // 프로젝트 액션
      createProject: (name, description) => {
        const newProject: Project = {
          id: `project-${Date.now()}`,
          name,
          description,
          panels: [
            {
              id: 'panel-1',
              prompt: '',
              isGenerating: false,
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          isAutoSaving: false,
        };
        
        set((state) => ({
          currentProject: newProject,
          projects: [...state.projects, newProject],
          panels: newProject.panels,
          activePanel: 0,
        }));
      },

      loadProject: async (projectId) => {
        try {
          const response = await fetch(`/api/studio/load-project?projectId=${projectId}`);
          const data = await response.json();
          
          if (data.success) {
            set({
              currentProject: data.currentProject,
              panels: data.panels,
              activePanel: data.panels.length > 0 ? 0 : null,
            });
          } else {
            console.error('Failed to load project:', data.error);
            alert(data.error);
          }
        } catch (error) {
          console.error('Load project error:', error);
          alert('프로젝트 로드 중 오류가 발생했습니다');
        }
      },

      saveProject: async () => {
        const { currentProject, panels } = get();
        if (!currentProject) return;
        
        set({
          currentProject: {
            ...currentProject,
            isAutoSaving: true,
          }
        });
        
        try {
          // 모든 환경에서 Supabase API 호출
          const isNewProject = currentProject.id.startsWith('project-') && currentProject.id.includes(Date.now().toString().substring(0, 8));
          
          const response = await fetch('/api/studio/save-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: isNewProject ? null : currentProject.id,
              projectName: currentProject.name,
              panels: panels.map(panel => ({
                prompt: panel.prompt,
                imageUrl: panel.imageUrl,
                content: panel.prompt,
                settings: {},
                metadata: {
                  style: panel.style,
                  emotion: panel.emotion,
                  characters: panel.characters,
                  generatedAt: panel.generatedAt,
                  tokensUsed: panel.tokensUsed,
                }
              })),
            }),
          });

          const data = await response.json();
          
          if (data.success) {
            set((state) => ({
              currentProject: state.currentProject ? {
                ...state.currentProject,
                id: data.projectId,
                updatedAt: new Date(),
                isAutoSaving: false,
              } : null
            }));
            
            // 프로젝트가 성공적으로 저장되면 자동 저장 활성화
            const autoSaveInterval = setInterval(async () => {
              const currentState = get();
              if (currentState.currentProject && !currentState.currentProject.isAutoSaving) {
                await currentState.saveProject();
              }
            }, 30000); // 30초마다 자동 저장

            // 스토어에 인터벌 ID 저장 (필요시 정리용)
            set((state) => ({
              ...state,
              autoSaveInterval: autoSaveInterval
            }));
            
          } else {
            console.error('Failed to save project:', data.error);
            alert(data.error);
          }
        } catch (error) {
          console.error('Save project error:', error);
          alert('프로젝트 저장 중 오류가 발생했습니다');
        } finally {
          set((state) => ({
            currentProject: state.currentProject ? {
              ...state.currentProject,
              isAutoSaving: false,
            } : null
          }));
        }
      },

      renameProject: (name) => {
        set((state) => ({
          currentProject: state.currentProject ? {
            ...state.currentProject,
            name,
            updatedAt: new Date(),
          } : null
        }));
      },

      // 패널 액션
      addPanel: () => {
        set((state) => {
          const newPanel: Panel = {
            id: `panel-${Date.now()}`,
            prompt: '',
            isGenerating: false,
          };
          return {
            panels: [...state.panels, newPanel],
            activePanel: state.panels.length,
          };
        });
      },

      removePanel: (index) => {
        set((state) => {
          const newPanels = state.panels.filter((_, i) => i !== index);
          const newActivePanel = index >= newPanels.length 
            ? Math.max(0, newPanels.length - 1) 
            : index;
          
          return {
            panels: newPanels,
            activePanel: newPanels.length > 0 ? newActivePanel : null,
          };
        });
      },

      duplicatePanel: (index) => {
        set((state) => {
          const panelToDuplicate = state.panels[index];
          if (!panelToDuplicate) return state;
          
          const duplicatedPanel: Panel = {
            ...panelToDuplicate,
            id: `panel-${Date.now()}`,
            imageUrl: undefined,
            thumbnailUrl: undefined,
            isGenerating: false,
            generatedAt: undefined,
          };
          
          const newPanels = [...state.panels];
          newPanels.splice(index + 1, 0, duplicatedPanel);
          
          return {
            panels: newPanels,
            activePanel: index + 1,
          };
        });
      },

      reorderPanels: (fromIndex, toIndex) => {
        set((state) => {
          const newPanels = [...state.panels];
          const [removed] = newPanels.splice(fromIndex, 1);
          newPanels.splice(toIndex, 0, removed);
          
          return {
            panels: newPanels,
            activePanel: toIndex,
          };
        });
      },

      selectPanel: (index) => {
        set({ activePanel: index });
      },

      selectMultiplePanels: (indices) => {
        set({ selectedPanels: indices });
      },

      updatePanelPrompt: (index, prompt) => {
        set((state) => {
          const newPanels = [...state.panels];
          if (newPanels[index]) {
            newPanels[index].prompt = prompt;
          }
          return { panels: newPanels };
        });
      },

      updatePanelImage: (index, imageUrl, thumbnailUrl) => {
        set((state) => {
          const newPanels = [...state.panels];
          if (newPanels[index]) {
            newPanels[index].imageUrl = imageUrl;
            newPanels[index].thumbnailUrl = thumbnailUrl;
            newPanels[index].generatedAt = new Date();
            newPanels[index].isGenerating = false;
          }
          return { panels: newPanels };
        });
      },

      // 캐릭터 액션
      loadCharacters: async () => {
        try {
          const response = await fetch('/api/characters');
          const data = await response.json();
          
          if (data.success) {
            const characters = data.characters.map((char: any) => ({
              id: char.id,
              name: char.name,
              description: char.description,
              imageUrl: char.referenceImages?.[0] || '',
              aliases: char.aliases || [],
              isActive: false,
              lastUsed: new Date(char.updatedAt),
            }));
            
            set({ characters });
          }
        } catch (error) {
          console.error('Failed to load characters:', error);
        }
      },

      toggleCharacter: (characterId) => {
        set((state) => ({
          characters: state.characters.map(char =>
            char.id === characterId
              ? { ...char, isActive: !char.isActive }
              : char
          ),
          activeCharacters: state.characters.find(c => c.id === characterId)?.isActive
            ? state.activeCharacters.filter(id => id !== characterId)
            : [...state.activeCharacters, characterId]
        }));
      },

      setActiveCharacters: (characterIds) => {
        set((state) => ({
          activeCharacters: characterIds,
          characters: state.characters.map(char => ({
            ...char,
            isActive: characterIds.includes(char.id)
          }))
        }));
      },

      // 생성 액션
      generatePanel: async (index, canvasRatio?: CanvasRatio) => {
        const { panels, activeCharacters, selectedStyle, selectedEmotion } = get();
        const panel = panels[index];
        if (!panel || !panel.prompt) return;
        
        // 캔버스 비율 정보 추가
        const aspectRatio = canvasRatio || '4:5';
        const aspectInfo = aspectRatio === '4:5' 
          ? { width: 800, height: 1000, description: 'vertical Instagram format (4:5)' }
          : { width: 800, height: 800, description: 'square Instagram format (1:1)' };

        // 패널 생성 상태 업데이트
        set((state) => {
          const newPanels = [...state.panels];
          newPanels[index] = { ...newPanels[index], isGenerating: true };
          return { panels: newPanels, isGenerating: true };
        });

        try {
          const response = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: panel.prompt,
              characterIds: activeCharacters,
              settings: {
                style: selectedStyle,
                emotion: selectedEmotion,
                aspectRatio: aspectRatio,
                width: aspectInfo.width,
                height: aspectInfo.height,
              },
            }),
          });

          const data = await response.json();
          console.log('🔍 API Response:', data);

          if (data.success) {
            console.log('✅ Updating panel with imageUrl:', data.imageUrl);
            set((state) => {
              const newPanels = [...state.panels];
              newPanels[index] = {
                ...newPanels[index],
                imageUrl: data.imageUrl,
                thumbnailUrl: data.thumbnailUrl,
                isGenerating: false,
                generatedAt: new Date(),
                tokensUsed: data.tokensUsed,
                characters: data.detectedCharacters,
              };
              console.log('📝 Updated panel:', newPanels[index]);
              return { 
                panels: newPanels, 
                isGenerating: false,
                tokenBalance: data.remainingTokens || state.tokenBalance,
              };
            });
          } else {
            throw new Error(data.error);
          }
        } catch (error) {
          console.error('Generation failed:', error);
          set((state) => {
            const newPanels = [...state.panels];
            newPanels[index] = { ...newPanels[index], isGenerating: false };
            return { panels: newPanels, isGenerating: false };
          });
        }
      },

      editPanel: async (index, editPrompt, canvasRatio?: CanvasRatio) => {
        const { panels, activeCharacters, selectedStyle, selectedEmotion } = get();
        const panel = panels[index];
        if (!panel || !panel.imageUrl) return;
        
        // 캔버스 비율 정보 추가
        const aspectRatio = canvasRatio || '4:5';
        const aspectInfo = aspectRatio === '4:5' 
          ? { width: 800, height: 1000, description: 'vertical Instagram format (4:5)' }
          : { width: 800, height: 800, description: 'square Instagram format (1:1)' };

        // 패널 편집 상태 업데이트
        set((state) => {
          const newPanels = [...state.panels];
          newPanels[index] = { ...newPanels[index], isGenerating: true };
          return { panels: newPanels, isGenerating: true };
        });

        try {
          const response = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: editPrompt, // 수정 프롬프트 사용
              characterIds: activeCharacters,
              referenceImage: panel.imageUrl, // 기존 이미지를 참조로 사용
              editMode: true, // 편집 모드 플래그
              settings: {
                style: selectedStyle,
                emotion: selectedEmotion,
                aspectRatio: aspectRatio,
                width: aspectInfo.width,
                height: aspectInfo.height,
              },
            }),
          });

          const data = await response.json();
          console.log('🔍 Edit API Response:', data);

          if (data.success) {
            console.log('✅ Updating panel with edited imageUrl:', data.imageUrl);
            set((state) => {
              const newPanels = [...state.panels];
              newPanels[index] = {
                ...newPanels[index],
                imageUrl: data.imageUrl,
                thumbnailUrl: data.thumbnailUrl,
                isGenerating: false,
                generatedAt: new Date(),
                tokensUsed: data.tokensUsed,
                characters: data.detectedCharacters,
              };
              console.log('📝 Updated edited panel:', newPanels[index]);
              return { 
                panels: newPanels, 
                isGenerating: false,
                tokenBalance: data.remainingTokens || state.tokenBalance,
              };
            });
          } else {
            throw new Error(data.error);
          }
        } catch (error) {
          console.error('Edit failed:', error);
          alert(error instanceof Error ? error.message : "이미지 수정 중 오류가 발생했습니다.");
          
          // 생성 실패 시 상태 복원
          set((state) => {
            const newPanels = [...state.panels];
            newPanels[index] = { ...newPanels[index], isGenerating: false };
            return { panels: newPanels, isGenerating: false };
          });
        }
      },

      generateBatch: async (indices, canvasRatio) => {
        for (const index of indices) {
          await get().generatePanel(index, canvasRatio);
          // 배치 생성 시 1초 대기 (API 레이트 리밋 고려)
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      },

      cancelGeneration: () => {
        set({ isGenerating: false, generationQueue: [] });
      },

      // UI 액션
      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setCanvasZoom: (zoom) => {
        set({ canvasZoom: Math.max(0.1, Math.min(3, zoom)) });
      },

      toggleGrid: () => {
        set((state) => ({ canvasGrid: !state.canvasGrid }));
      },

      // 편집기 액션
      setPromptText: (text) => {
        set({ promptText: text });
      },

      setStyle: (style) => {
        set({ selectedStyle: style });
      },

      setEmotion: (emotion) => {
        set({ selectedEmotion: emotion });
      },

      // 토큰 액션
      updateTokenBalance: (balance) => {
        set({ tokenBalance: balance });
      },
    }),
    { name: 'studio-store' }
  )
);