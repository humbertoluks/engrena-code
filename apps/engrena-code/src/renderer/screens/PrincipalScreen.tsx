import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { usePrincipalWorkspace } from '../hooks/usePrincipalWorkspace'
import { useChatScroll } from '../hooks/useChatScroll'
import { useResponsiveLayout } from '../hooks/useResponsiveLayout'
import { PANEL_WIDTH } from '../hooks/responsiveLayout.logic'
import { ProjectTree, ProjectTreeCollapsedRail } from '../components/workspace/ProjectTree'
import { AddProjectModal } from '../components/workspace/AddProjectModal'
import { TaskComposer } from '../components/workspace/TaskComposer'
import { ChatContextBar } from '../components/workspace/ChatContextBar'
import { ChatHistory } from '../components/workspace/ChatHistory'
import { DiffViewer } from '../components/workspace/DiffViewer'
import { WorkspaceSidebar, WorkspaceSidebarCollapsedRail } from '../components/workspace/WorkspaceSidebar'
import { TerminalDock } from '../components/workspace/TerminalDock'
import { SubagentRunAuditModal } from '../components/subagents/SubagentRunAuditModal'
import { GRAPH_COPY } from '../components/workspace/graph/graphCopy'
import { isPendingActive } from '../components/workspace/pendingMessages.logic'

const ExecutionGraphPanel = lazy(() => import('../components/workspace/graph/ExecutionGraphPanel'))

const COPY = {
  tabHistory: 'Histórico',
  tabDiff: 'Diff',
  tabGraph: GRAPH_COPY.tab,
  mcpNoticeDismiss: 'Dispensar avisos',
  jumpToLatest: 'Ir para o final (ctrl+End)',
  jumpNotice: 'O agente respondeu.',
  closeDrawer: 'Fechar painel',
} as const

export function PrincipalScreen(): ReactElement {
  const ws = usePrincipalWorkspace()
  const [terminalMaximized, setTerminalMaximized] = useState(false)
  // Preferência de recolher + trilho imposto pela largura da janela (ver responsiveLayout.logic).
  const layout = useResponsiveLayout()

  // Cola no fim só enquanto o usuário já estava perto do fim; longe dele a resposta nova vira
  // CTA em vez de salto (ver useChatScroll).
  const lastAssistant = [...ws.messages].reverse().find((m) => m.role === 'assistant') ?? null
  const chatScroll = useChatScroll<HTMLDivElement>({
    // O gate entra no sinal porque o pedido chega antes do tool_call existir: sem ele o card
    // inline nasceria fora de vista e o turno pareceria travado sem nada para responder.
    signal: `${ws.selectedThreadId ?? ''}|${ws.messages.length}|${ws.toolCalls.length}|${ws.streamingText.length}|${ws.chatPendingMessages.length}|${ws.gate?.gateId ?? ''}`,
    enabled: ws.activeTab === 'history' && !terminalMaximized,
    active:
      ws.selectedThread?.state === 'running' ||
      ws.selectedThread?.state === 'waiting_permission',
    latestKey: `${lastAssistant?.id ?? ''}|${lastAssistant?.content?.length ?? 0}`,
    resetKey: ws.selectedThreadId ?? '',
  })
  const showJump = chatScroll.showJump && ws.activeTab === 'history' && !terminalMaximized

  const pendingDiffCount = ws.diffs.filter((d) => d.status === 'pending').length

  // Deep-link do Dashboard (F04): "#principal?project=<id>&thread=<id>&tab=diff|history".
  const deepLinkAppliedRef = useRef(false)
  useEffect(() => {
    if (deepLinkAppliedRef.current || ws.projects === null) return
    deepLinkAppliedRef.current = true

    const queryIndex = window.location.hash.indexOf('?')
    if (queryIndex === -1) return
    const params = new URLSearchParams(window.location.hash.slice(queryIndex + 1))

    const projectId = params.get('project')
    const threadId = params.get('thread')
    const tab = params.get('tab')

    if (projectId) ws.selectProject(projectId)
    if (threadId) ws.selectThread(threadId)
    if (tab === 'diff' || tab === 'history' || tab === 'graph') ws.setActiveTab(tab)
  }, [ws.projects, ws.selectProject, ws.selectThread, ws.setActiveTab])

  const projectTree = (
    <ProjectTree
      projects={ws.projects}
      selectedProjectId={ws.selectedProjectId}
      selectedThreadId={ws.selectedThreadId}
      threadsByProject={ws.threadsByProject}
      threadsLoading={ws.threadsLoading}
      threadsError={ws.threadsError}
      onSelectProject={ws.selectProject}
      onSelectThread={(threadId) => {
        ws.selectThread(threadId)
        // Sobreposto, o painel cobre a conversa: escolher a thread já é o fim da tarefa ali.
        layout.closeOverlay()
      }}
      onNewThread={(projectId) => {
        ws.selectProject(projectId)
        ws.newThread()
        layout.closeOverlay()
      }}
      onAddProjectClick={() => ws.setAddProjectModalOpen(true)}
      onRemoveProject={(id) => void ws.removeProject(id)}
      onCollapse={() => layout.collapse('left')}
      onSearchThreads={(projectId, query) => void ws.searchThreads(projectId, query)}
      onRenameThread={(threadId, title) => void ws.renameThread(threadId, title)}
      onExportThread={(threadId, format) => void ws.exportThread(threadId, format)}
      exporting={ws.exporting}
      exportError={ws.exportError}
      onDismissExportError={ws.clearExportError}
    />
  )

  const workspaceSidebar = (
    <WorkspaceSidebar
      onActiveFileChange={ws.setActiveFile}
      project={ws.selectedProject}
      selectedThread={ws.selectedThread}
      vcsStatus={ws.vcsStatus}
      memoryStatus={ws.memoryStatus}
      usageLimitStatus={ws.usageLimitStatus}
      onMemoryChanged={ws.refreshMemoryStatus}
      subagentRuns={ws.subagentRuns}
      onOpenSubagentRun={ws.openSubagentRun}
      pipeline={ws.pipeline}
      onAnswerPipelineCheckpoint={(input) => void ws.answerQuestion(input)}
      pipelineAnswerBusy={ws.gateBusy}
      pipelineAnswerError={ws.gateError}
      onCancelPipeline={() => void ws.cancel()}
      onNewThread={ws.newThread}
      onCommit={ws.gitCommit}
      onPush={ws.gitPush}
      onOpenPr={ws.openPr}
      onTextgen={ws.gitTextgen}
      onCollapse={() => layout.collapse('right')}
    />
  )

  return (
    <div ref={layout.containerRef} className="relative h-full">
      <div
        className="grid h-full gap-sm overflow-hidden p-sm transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none"
        style={{ gridTemplateColumns: layout.gridTemplateColumns }}
      >
        {layout.left === 'rail' ? <ProjectTreeCollapsedRail onExpand={() => layout.expand('left')} /> : projectTree}

        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface">
          <div
            className={
              terminalMaximized
                ? 'hidden'
                : 'flex items-center gap-xs border-b border-border px-md py-xs'
            }
          >
            <button
              type="button"
              onClick={() => ws.setActiveTab('history')}
              className={`rounded-md px-sm py-[3px] text-[12px] ${
                ws.activeTab === 'history' ? 'bg-surface-2 text-fg' : 'text-muted'
              }`}
            >
              {COPY.tabHistory}
            </button>
            <button
              type="button"
              onClick={() => ws.setActiveTab('diff')}
              className={`flex items-center gap-xs rounded-md px-sm py-[3px] text-[12px] ${
                ws.activeTab === 'diff' ? 'bg-surface-2 text-fg' : 'text-muted'
              }`}
            >
              {COPY.tabDiff}
              {pendingDiffCount > 0 ? (
                <span className="rounded-full bg-amber/[0.14] px-[6px] text-[10px] text-amber">{pendingDiffCount}</span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => ws.setActiveTab('graph')}
              className={`rounded-md px-sm py-[3px] text-[12px] ${
                ws.activeTab === 'graph' ? 'bg-surface-2 text-fg' : 'text-muted'
              }`}
            >
              {COPY.tabGraph}
            </button>

            {/* O que o painel recolhido deixaria de contar migra para cá — ver ChatContextBar. */}
            <ChatContextBar
              showIdentity={layout.left === 'rail'}
              showRepo={layout.right === 'rail'}
              projectName={ws.selectedProject?.name ?? null}
              thread={ws.selectedThread}
              vcsStatus={ws.vcsStatus}
            />
          </div>

          {ws.mcpNotices.length > 0 ? (
            <div
              role="status"
              className={
                terminalMaximized
                  ? 'hidden'
                  : 'flex flex-col gap-xs border-b border-amber/30 bg-amber/[0.10] px-md py-sm'
              }
            >
              {ws.mcpNotices.map((notice, i) => (
                <p key={`${notice.kind}-${i}`} className="text-[12.5px] text-amber">
                  {notice.message}
                </p>
              ))}
              <button
                type="button"
                onClick={ws.dismissMcpNotices}
                aria-label={COPY.mcpNoticeDismiss}
                className="w-fit text-[11.5px] text-amber underline hover:no-underline"
              >
                {COPY.mcpNoticeDismiss}
              </button>
            </div>
          ) : null}

          {/* React Flow exige altura fixa — a aba grafo fica fora do container com overflow-y-auto. */}
          {ws.activeTab === 'graph' && !terminalMaximized ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-[13px] text-muted">
                    {GRAPH_COPY.loading}
                  </div>
                }
              >
                <ExecutionGraphPanel
                  thread={ws.selectedThread}
                  toolCalls={ws.toolCalls}
                  subagentRuns={ws.subagentRuns}
                  pipeline={ws.pipeline}
                  liveOverlay={ws.liveGraphOverlay}
                />
              </Suspense>
            </div>
          ) : (
            <>
              {/* [overflow-anchor:none]: a rolagem deste container é programática (useChatScroll);
                  o scroll anchoring nativo do Chromium seria um segundo escritor de scrollTop,
                  brigando com o stick a cada reflow do turno. */}
              <div
                ref={chatScroll.ref}
                className={terminalMaximized ? 'hidden' : 'min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]'}
              >
                {ws.activeTab === 'history' ? (
                  <ChatHistory
                    messages={ws.messages}
                    pendingMessages={ws.chatPendingMessages}
                    threadId={ws.selectedThreadId}
                    toolCalls={ws.toolCalls}
                    subagentRuns={ws.subagentRuns}
                    onOpenSubagentRun={ws.openSubagentRun}
                    childTools={ws.liveGraphOverlay.childTools}
                    loading={ws.historyLoading}
                    error={ws.historyError}
                    streamingText={ws.streamingText}
                    hasThread={ws.selectedThreadId !== null}
                    threadState={ws.selectedThread?.state ?? null}
                    gate={ws.gate}
                    gateQueuedCount={ws.gateQueuedCount}
                    onPermissionDecide={ws.sendDecision}
                    onPickAskOption={(text) => ws.updateComposer({ text })}
                    gateBusy={ws.gateBusy}
                    gateError={ws.gateError}
                    feedback={ws.feedback}
                    onVote={(messageId, vote) => void ws.voteMessage(messageId, vote)}
                    followups={ws.followups}
                    followupsMessageId={ws.followupsMessageId}
                    followupsPending={ws.followupsPending}
                    onDecide={(text) => ws.updateComposer({ text })}
                    onPickFollowup={(text) => ws.updateComposer({ text })}
                  />
                ) : (
                  <DiffViewer
                    diffs={ws.diffs}
                    onAccept={(ids) => ws.acceptDiffs({ action: 'accept', ids })}
                    onReject={(ids) => ws.acceptDiffs({ action: 'reject', ids })}
                    onResolveConflict={ws.resolveDiffConflict}
                    onOpenPr={ws.openPr}
                    canOpenPr={ws.selectedThread?.state === 'committed'}
                  />
                )}
              </div>
            </>
          )}

          {/* Faixa entre a conversa e o composer: só aparece com resposta nova fora de vista. */}
          {showJump ? (
            <div className="flex items-center justify-end gap-sm border-t border-border px-md py-xs">
              <span role="status" className="text-[12px] text-muted">
                {COPY.jumpNotice}
              </span>
              <button
                type="button"
                onClick={chatScroll.jumpToLatest}
                title={COPY.jumpToLatest}
                className="rounded-full bg-accent px-sm py-[3px] text-[12px] font-medium text-white hover:opacity-90"
              >
                {COPY.jumpToLatest}
              </button>
            </div>
          ) : null}

          <div className={terminalMaximized ? 'hidden' : 'border-t border-border p-sm'}>
            <TaskComposer
              composer={ws.composer}
              attachments={ws.composerAttachments}
              onAttach={ws.attach}
              onDetach={ws.detach}
              attachError={ws.attachError}
              onAttachCodebase={() => void ws.attachCodebase()}
              codebaseBusy={ws.codebaseBusy}
              savedPrompts={ws.savedPrompts}
              chatModes={ws.chatModes}
              modeCatalog={ws.modeCatalog}
              libraryError={ws.libraryError}
              onApplyChatMode={ws.applyChatMode}
              onSavePrompt={ws.savePromptFromComposer}
              onUpdateSavedPrompt={ws.updateSavedPromptFromComposer}
              onSaveChatMode={ws.saveChatModeFromComposer}
              onUpdateChatMode={ws.updateChatModeFromComposer}
              onRefreshLibrary={ws.reloadPromptLibrary}
              onDeleteSavedPrompt={(id) => void ws.deleteSavedPrompt(id)}
              onDeleteChatMode={(id, name) => void ws.deleteChatMode(id, name)}
              updateComposer={ws.updateComposer}
              onAccessLevelChange={(level) => void ws.setAccessLevel(level)}
              composerCatalog={ws.composerCatalog}
              selectedThread={ws.selectedThread}
              projectId={ws.selectedProjectId}
              queue={ws.queue}
              onDequeue={ws.dequeue}
              onUpdateQueueItem={ws.updateQueueItem}
              onPromoteQueueItem={ws.promoteQueueItem}
              onRunQueue={ws.runQueueNow}
              sendError={ws.sendError}
              configStatus={ws.configStatus}
              vcsStatus={ws.vcsStatus}
              usageLimitStatus={ws.usageLimitStatus}
              onSend={() => void ws.send()}
              onCancel={() => void ws.cancel()}
              gate={ws.gate}
              pendingActive={ws.chatPendingMessages.some((p) => isPendingActive(p.status))}
              onGitInit={() => (ws.selectedProjectId ? ws.gitInitProject(ws.selectedProjectId) : Promise.resolve())}
              hasProject={ws.selectedProjectId !== null}
            />
          </div>

          <TerminalDock
            projectId={ws.selectedProjectId}
            threadId={ws.selectedThreadId}
            onMaximizedChange={setTerminalMaximized}
          />
        </div>

        {layout.right === 'rail' ? (
          <WorkspaceSidebarCollapsedRail onExpand={() => layout.expand('right')} />
        ) : (
          workspaceSidebar
        )}
      </div>

      {/* Sobreposição: só existe quando a janela é estreita demais para a coluna. O trilho fica no
          lugar por baixo, então alargar a janela devolve o painel para onde ele estava. */}
      {layout.overlay !== null ? (
        <>
          <button
            type="button"
            onClick={layout.closeOverlay}
            aria-label={COPY.closeDrawer}
            className="absolute inset-0 z-30 cursor-default bg-fg/20 motion-safe:animate-[fade-in_120ms_ease-out]"
          />
          <div
            className={`absolute top-sm bottom-sm z-40 overflow-hidden rounded-xl shadow-[0_18px_48px_-16px_rgba(0,0,0,0.55)] ${
              layout.overlay === 'left'
                ? 'left-sm motion-safe:animate-[slide-in-left_140ms_ease-out]'
                : 'right-sm motion-safe:animate-[slide-in-right_140ms_ease-out]'
            }`}
            style={{ width: `${PANEL_WIDTH}px` }}
          >
            {layout.overlay === 'left' ? projectTree : workspaceSidebar}
          </div>
        </>
      ) : null}

      {ws.addProjectModalOpen ? (
        <AddProjectModal onClose={() => ws.setAddProjectModalOpen(false)} onSubmit={(path, name) => ws.addProject(path, name)} />
      ) : null}

      {ws.activeSubagentRun ? (
        <SubagentRunAuditModal run={ws.activeSubagentRun} onClose={ws.closeSubagentRun} />
      ) : null}

    </div>
  )
}
