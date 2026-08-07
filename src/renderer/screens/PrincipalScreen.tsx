import { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import { usePrincipalWorkspace } from '../hooks/usePrincipalWorkspace'
import { ProjectTree } from '../components/workspace/ProjectTree'
import { AddProjectModal } from '../components/workspace/AddProjectModal'
import { TaskComposer } from '../components/workspace/TaskComposer'
import { ChatHistory } from '../components/workspace/ChatHistory'
import { DiffViewer } from '../components/workspace/DiffViewer'
import { WorkspaceSidebar } from '../components/workspace/WorkspaceSidebar'
import { PermissionPrompt } from '../components/workspace/PermissionPrompt'
import { SubagentRunAuditModal } from '../components/subagents/SubagentRunAuditModal'

const COPY = {
  tabHistory: 'Histórico',
  tabDiff: 'Diff',
  mcpNoticeDismiss: 'Dispensar avisos',
} as const

export function PrincipalScreen(): ReactElement {
  const ws = usePrincipalWorkspace()

  const pendingDiffCount = ws.diffs.filter((d) => d.status === 'pending').length
  const currentPermission = ws.permissionQueue[0] ?? null

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
    if (tab === 'diff' || tab === 'history') ws.setActiveTab(tab)
  }, [ws.projects, ws.selectProject, ws.selectThread, ws.setActiveTab])

  return (
    <div className="grid h-full grid-cols-[280px_1fr_280px] gap-sm p-sm">
      <ProjectTree
        projects={ws.projects}
        selectedProjectId={ws.selectedProjectId}
        selectedThreadId={ws.selectedThreadId}
        threadsByProject={ws.threadsByProject}
        threadsLoading={ws.threadsLoading}
        threadsError={ws.threadsError}
        onSelectProject={ws.selectProject}
        onSelectThread={ws.selectThread}
        onNewThread={(projectId) => {
          ws.selectProject(projectId)
          ws.newThread()
        }}
        onAddProjectClick={() => ws.setAddProjectModalOpen(true)}
        onRemoveProject={(id) => void ws.removeProject(id)}
      />

      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-xs border-b border-border px-md py-xs">
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
        </div>

        {ws.mcpNotices.length > 0 ? (
          <div role="status" className="flex flex-col gap-xs border-b border-amber/30 bg-amber/[0.10] px-md py-sm">
            {ws.mcpNotices.map((notice, i) => (
              <p key={`${notice.mcpName}-${i}`} className="text-[12.5px] text-amber">{notice.message}</p>
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

        <div className="flex-1 overflow-y-auto">
          {ws.activeTab === 'history' ? (
            <ChatHistory
              messages={ws.messages}
              toolCalls={ws.toolCalls}
              subagentRuns={ws.subagentRuns}
              onOpenSubagentRun={ws.openSubagentRun}
              loading={ws.historyLoading}
              error={ws.historyError}
              streamingText={ws.streamingText}
              hasThread={ws.selectedThreadId !== null}
            />
          ) : (
            <DiffViewer
              diffs={ws.diffs}
              onAccept={(ids) => ws.acceptDiffs({ action: 'accept', ids })}
              onReject={(ids) => ws.acceptDiffs({ action: 'reject', ids })}
              onOpenPr={ws.openPr}
              canOpenPr={ws.selectedThread?.state === 'committed'}
            />
          )}
        </div>

        <div className="border-t border-border p-sm">
          <TaskComposer
            composer={ws.composer}
            updateComposer={ws.updateComposer}
            selectedThread={ws.selectedThread}
            queue={ws.queue}
            onDequeue={ws.dequeue}
            sendError={ws.sendError}
            configStatus={ws.configStatus}
            vcsStatus={ws.vcsStatus}
            onSend={() => void ws.send()}
            onCancel={() => void ws.cancel()}
            onGitInit={() => (ws.selectedProjectId ? ws.gitInitProject(ws.selectedProjectId) : Promise.resolve())}
            hasProject={ws.selectedProjectId !== null}
          />
        </div>
      </div>

      <WorkspaceSidebar
        project={ws.selectedProject}
        selectedThread={ws.selectedThread}
        vcsStatus={ws.vcsStatus}
        subagentRuns={ws.subagentRuns}
        onOpenSubagentRun={ws.openSubagentRun}
        onNewThread={ws.newThread}
        onCommit={ws.gitCommit}
        onPush={ws.gitPush}
        onOpenPr={ws.openPr}
        onTextgen={ws.gitTextgen}
      />

      {ws.addProjectModalOpen ? (
        <AddProjectModal onClose={() => ws.setAddProjectModalOpen(false)} onSubmit={(path, name) => ws.addProject(path, name)} />
      ) : null}

      {ws.activeSubagentRun ? (
        <SubagentRunAuditModal run={ws.activeSubagentRun} onClose={ws.closeSubagentRun} />
      ) : null}

      {currentPermission ? (
        <PermissionPrompt
          toolName={currentPermission.toolName}
          params={currentPermission.params}
          queuedCount={ws.permissionQueue.length - 1}
          onAllow={() => void ws.resolvePermission(currentPermission.requestId, true)}
          onDeny={() => void ws.resolvePermission(currentPermission.requestId, false)}
        />
      ) : null}
    </div>
  )
}
