import {
    ArrowLeftRegular,
    Book2Regular,
    BookmarkRegular,
    CheckRegular,
    CloseRegular,
    ComputerRegular,
    Filter3Regular,
    HashtagRegular,
    Home4Regular,
    InformationRegular,
    LayoutBottomOpenRegular,
    Loading3Regular,
    MenuRegular,
    MoonRegular,
    NotificationRegular,
    Refresh3Regular,
    Search2Regular,
    ShieldRegular,
    SunRegular,
    WindowsRegular,
} from '@mingcute/react/core-regular';
import { Fragment, useState } from 'react';
import { getDeviceUuid, isDemo } from '../api';
import { IconButton } from '../components/IconButton';
import { BookmarkDeleteDialog, SideBookmarkMenu } from '../features/bookmarks/BookmarkDialogs';
import { CommentsPanel } from '../features/comments/CommentsPanel';
import { Composer } from '../features/composer/Composer';
import { DocumentationPage } from '../features/docs/DocumentationPage';
import { EmptyState, LoadingRows } from '../features/feed/FeedStates';
import { HoleRow } from '../features/feed/HoleRow';
import { NotificationCenter } from '../features/notifications/NotificationCenter';
import { BlockingWordsDialog } from '../features/settings/BlockingWordsDialog';
import { SideTagMenu, TagPicker } from '../features/tags/TagMenus';
import type { AppController } from './useAppController';

const PKU_LOGO_URL = 'https://cdn.arthals.ink/css/src/PKU.svg';

export function AppView({ controller }: { controller: AppController }) {
    const {
        mode,
        docsOpen,
        setDocsOpen,
        themeMode,
        commentViewMode,
        mobileMenuOpen,
        setMobileMenuOpen,
        queryInput,
        setQueryInput,
        recentSearches,
        activeQuery,
        selectedLabel,
        setSelectedLabel,
        selectedBookmark,
        tags,
        bookmarkGroups,
        blockingWords,
        postingIdentities,
        holes,
        page,
        lastPage,
        candidateTotal,
        loading,
        feedError,
        setRefreshKey,
        selectedHole,
        setSelectedHole,
        detailStack,
        detailLoadingPid,
        expandedCommentPids,
        bookmarkMenuPid,
        setBookmarkMenuPid,
        copyMenuPid,
        setCopyMenuPid,
        bookmarkBusy,
        bookmarkDeleteTarget,
        setBookmarkDeleteTarget,
        blockingWordsOpen,
        setBlockingWordsOpen,
        blockingWordsBusy,
        notificationsOpen,
        setNotificationsOpen,
        unreadNotifications,
        likingPids,
        toast,
        setToast,
        searchRef,
        feedSentinelRef,
        refreshUnreadCount,
        visibleHoles,
        highlightTerms,
        switchMode,
        goHome,
        openDocumentation,
        submitSearch,
        selectRecentSearch,
        clearRecentSearches,
        clearSearch,
        cycleTheme,
        toggleCommentView,
        openComments,
        closeInlineComments,
        closeHoleDetails,
        goBackInHoleDetails,
        openHoleDetails,
        openReferencedPid,
        loadFirstPage,
        updateHole,
        toggleBookmarkDirect,
        toggleBookmarkFor,
        createBookmarkFor,
        createEmptyBookmark,
        deleteBookmarkGroup,
        togglePraiseFor,
        copyHole,
        copyPid,
        saveBlockingWords,
        handlePublished,
        isSearching,
        currentDetailHole,
    } = controller;
    const [searchHistoryOpen, setSearchHistoryOpen] = useState(false);

    const themeIcon =
        themeMode === 'light' ? (
            <SunRegular size={18} />
        ) : themeMode === 'dark' ? (
            <MoonRegular size={18} />
        ) : (
            <ComputerRegular size={18} />
        );
    const themeLabel = themeMode === 'light' ? '浅色' : themeMode === 'dark' ? '深色' : '跟随系统';
    const commentViewLabel = commentViewMode === 'modal' ? '悬浮' : '展开';

    const renderSideTools = (tagMenuPlacement: 'left' | 'right') => (
        <>
            <section className="side-bookmarks-section">
                <div className="side-heading">
                    <span>收藏夹</span>
                    <BookmarkRegular size={17} />
                </div>
                <SideBookmarkMenu
                    groups={bookmarkGroups}
                    active={!docsOpen && mode === 'bookmarks'}
                    selectedId={selectedBookmark}
                    onSelect={(id) => switchMode('bookmarks', id)}
                    onCreate={createEmptyBookmark}
                    onRequestDelete={setBookmarkDeleteTarget}
                    busy={bookmarkBusy}
                />
            </section>
            <section className="side-tags-section">
                <div className="side-heading">
                    <span>标签</span>
                    <HashtagRegular size={17} />
                </div>
                <SideTagMenu
                    tags={tags}
                    value={selectedLabel}
                    placement={tagMenuPlacement}
                    onChange={(value) => {
                        setDocsOpen(false);
                        setSelectedLabel(value);
                        setMobileMenuOpen(false);
                    }}
                />
            </section>
            <section className="side-settings-section">
                <button
                    type="button"
                    className="side-settings-button"
                    onClick={() => {
                        setBlockingWordsOpen(true);
                        setMobileMenuOpen(false);
                    }}>
                    <span>
                        <ShieldRegular size={16} />
                        屏蔽词
                    </span>
                    <small>{blockingWords.length ? `${blockingWords.length} 个` : '未设置'}</small>
                </button>
            </section>
        </>
    );

    return (
        <div
            className="app-shell"
            onClick={() => {
                setBookmarkMenuPid(null);
                setCopyMenuPid(null);
                setMobileMenuOpen(false);
            }}>
            {mobileMenuOpen && (
                <button
                    type="button"
                    className="mobile-drawer-scrim"
                    aria-label="关闭导航"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}
            <aside
                className={`left-rail ${mobileMenuOpen ? 'mobile-open' : ''}`}
                onClick={(event) => event.stopPropagation()}>
                <button type="button" className="brand" onClick={goHome} title="返回首页最新">
                    <img src={PKU_LOGO_URL} alt="北京大学" />
                    <div>
                        <strong>北大树洞</strong>
                        <span>Treehole Art</span>
                    </div>
                </button>
                <nav aria-label="主导航">
                    <button
                        type="button"
                        className={!docsOpen && mode === 'latest' ? 'active' : ''}
                        onClick={() => switchMode('latest')}>
                        <Home4Regular size={19} />
                        <span>最新</span>
                    </button>
                    <button
                        type="button"
                        className={!docsOpen && mode === 'bookmarks' ? 'active' : ''}
                        onClick={() => switchMode('bookmarks')}>
                        <BookmarkRegular size={19} />
                        <span>收藏</span>
                    </button>
                    <button type="button" className={docsOpen ? 'active' : ''} onClick={openDocumentation}>
                        <Book2Regular size={19} />
                        <span>文档</span>
                    </button>
                </nav>
                <div className="rail-context-tools" aria-label="内容管理">
                    {renderSideTools('right')}
                </div>
                <div className="rail-footer">
                    <span className="rail-connection">
                        <span className="status-dot" />
                        {isDemo ? '本地预览' : '已连接树洞'}
                    </span>
                    <span className="rail-credit">Treehole Art @ Arthals</span>
                </div>
            </aside>

            <main className="main-column">
                <header className="topbar">
                    <button type="button" className="mobile-home-button" aria-label="返回首页最新" onClick={goHome}>
                        <img className="mobile-pku-logo" src={PKU_LOGO_URL} alt="北京大学" />
                    </button>
                    <IconButton
                        label={mobileMenuOpen ? '关闭导航' : '打开导航'}
                        className="mobile-menu-button"
                        aria-expanded={mobileMenuOpen}
                        onClick={(event) => {
                            event.stopPropagation();
                            setMobileMenuOpen((open) => !open);
                        }}>
                        {mobileMenuOpen ? <CloseRegular size={20} /> : <MenuRegular size={20} />}
                    </IconButton>
                    <form
                        className="search-box"
                        onSubmit={(event) => {
                            submitSearch(event);
                            setSearchHistoryOpen(false);
                        }}
                        onFocus={() => setSearchHistoryOpen(true)}
                        onBlur={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                                setSearchHistoryOpen(false);
                            }
                        }}>
                        <Search2Regular size={18} />
                        <input
                            ref={searchRef}
                            value={queryInput}
                            onChange={(event) => setQueryInput(event.target.value)}
                            onClick={() => setSearchHistoryOpen(true)}
                            placeholder="搜索内容或 #洞号，| 或搜索"
                            aria-label="搜索树洞"
                            aria-expanded={searchHistoryOpen && recentSearches.length > 0}
                            aria-controls="recent-searches"
                            title="使用 | 分隔或搜索，使用 -:关键字 排除包含该词的结果"
                        />
                        {queryInput && (
                            <IconButton label="清空搜索" className="search-clear" onClick={clearSearch}>
                                <CloseRegular size={15} />
                            </IconButton>
                        )}
                        <button type="submit" className="search-submit">
                            搜索
                        </button>
                        {searchHistoryOpen && recentSearches.length > 0 && (
                            <div id="recent-searches" className="search-history" aria-label="最近搜索">
                                <div className="search-history-heading">
                                    <span>最近搜索</span>
                                    <button type="button" onClick={clearRecentSearches}>
                                        清除
                                    </button>
                                </div>
                                <div className="search-history-list">
                                    {recentSearches.map((query) => (
                                        <button
                                            type="button"
                                            key={query}
                                            title={query}
                                            onClick={() => {
                                                selectRecentSearch(query);
                                                setSearchHistoryOpen(false);
                                            }}>
                                            <Search2Regular size={14} />
                                            <span>{query}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </form>
                    <div className="topbar-actions">
                        <IconButton
                            label={unreadNotifications ? `${unreadNotifications} 条未读消息` : '消息通知'}
                            className={`notification-button ${unreadNotifications ? 'has-unread' : ''}`}
                            onClick={() => setNotificationsOpen(true)}>
                            <NotificationRegular size={18} />
                            {unreadNotifications > 0 && (
                                <span className="notification-badge">{Math.min(unreadNotifications, 99)}</span>
                            )}
                        </IconButton>
                        <IconButton label={`评论展示：${commentViewLabel}，点击切换`} onClick={toggleCommentView}>
                            {commentViewMode === 'modal' ? (
                                <WindowsRegular size={18} />
                            ) : (
                                <LayoutBottomOpenRegular size={18} />
                            )}
                        </IconButton>
                        <IconButton label={`外观：${themeLabel}，点击切换`} onClick={cycleTheme}>
                            {themeIcon}
                        </IconButton>
                        <IconButton label="刷新" onClick={() => setRefreshKey((key) => key + 1)}>
                            <Refresh3Regular size={18} />
                        </IconButton>
                    </div>
                </header>

                {docsOpen ? (
                    <DocumentationPage />
                ) : (
                    <>
                        <Composer
                            tags={tags}
                            identities={postingIdentities}
                            onPublished={handlePublished}
                            onNotice={setToast}
                        />

                        <div className="feed-heading">
                    <div>
                        <h1>{mode === 'latest' ? '最新树洞' : '我的收藏'}</h1>
                        <span>{candidateTotal ? `${candidateTotal} 条内容` : '实时更新'}</span>
                    </div>
                    <TagPicker
                        tags={tags}
                        value={selectedLabel}
                        onChange={setSelectedLabel}
                        icon={<Filter3Regular size={16} />}
                        placeholder="全部标签"
                        emptyLabel="全部标签"
                        ariaLabel="筛选标签"
                        className="feed-tag-picker"
                    />
                        </div>

                        {activeQuery.hasAdvanced && (
                    <div className="query-summary" role="status">
                        <div className="query-chips">
                            {activeQuery.orQueries.length === 1 && (
                                <span className="query-chip neutral">搜索 · {activeQuery.baseQuery}</span>
                            )}
                            {activeQuery.orQueries.length > 1 &&
                                activeQuery.orQueries.map((term) => (
                                    <span className="query-chip neutral" key={`o-${term}`}>
                                        或 · {term}
                                    </span>
                                ))}
                            {activeQuery.includes.map((term) => (
                                <span className="query-chip include" key={`i-${term}`}>
                                    + {term}
                                </span>
                            ))}
                            {activeQuery.excludes.map((term) => (
                                <span className="query-chip exclude" key={`e-${term}`}>
                                    排除 · {term}
                                </span>
                            ))}
                        </div>
                        <span>
                            {visibleHoles.length}/{holes.length} 匹配
                        </span>
                    </div>
                        )}

                        <section className="feed" aria-live="polite">
                    {loading ? (
                        <LoadingRows />
                    ) : feedError && !holes.length ? (
                        <div className="error-state">
                            <InformationRegular size={22} />
                            <strong>{feedError}</strong>
                            <button
                                type="button"
                                onClick={
                                    feedError.includes('登录')
                                        ? () =>
                                              window.location.assign(
                                                  `/redirect_iaaa_login?uuid=${encodeURIComponent(getDeviceUuid())}`,
                                              )
                                        : loadFirstPage
                                }>
                                {feedError.includes('登录') ? '重新登录' : '重试'}
                            </button>
                        </div>
                    ) : visibleHoles.length ? (
                        <>
                            {visibleHoles.map((hole) => (
                                <Fragment key={hole.pid}>
                                    <HoleRow
                                        hole={hole}
                                        bookmarkOpen={bookmarkMenuPid === hole.pid}
                                        copyOpen={copyMenuPid === hole.pid}
                                        bookmarkGroups={bookmarkGroups}
                                        bookmarkBusy={bookmarkBusy}
                                        praiseBusy={likingPids.has(hole.pid)}
                                        onOpenComments={() => openComments(hole)}
                                        onOpenBookmarkMenu={() => {
                                            setCopyMenuPid(null);
                                            setBookmarkMenuPid((current) => (current === hole.pid ? null : hole.pid));
                                        }}
                                        onToggleBookmarkDirect={() => void toggleBookmarkDirect(hole)}
                                        onOpenCopyMenu={() => {
                                            setBookmarkMenuPid(null);
                                            setCopyMenuPid((current) => (current === hole.pid ? null : hole.pid));
                                        }}
                                        onToggleBookmark={(group) => void toggleBookmarkFor(hole, group)}
                                        onCreateBookmark={(name) => void createBookmarkFor(hole, name)}
                                        onCopy={(includeComments) => {
                                            setCopyMenuPid(null);
                                            void copyHole(hole, includeComments);
                                        }}
                                        onTogglePraise={() => void togglePraiseFor(hole)}
                                        onCopyPid={(pid) => void copyPid(pid)}
                                        onOpenReferencedHole={(pid) => void openReferencedPid(pid, hole)}
                                        highlightTerms={highlightTerms}
                                        blockingWords={blockingWords}
                                    />
                                    {commentViewMode === 'inline' && expandedCommentPids.has(hole.pid) && (
                                        <CommentsPanel
                                            hole={hole}
                                            displayMode="inline"
                                            identities={postingIdentities}
                                            onClose={() => closeInlineComments(hole.pid)}
                                            onCommentPublished={() =>
                                                updateHole(hole.pid, (item) => ({ ...item, reply: item.reply + 1 }))
                                            }
                                            onNotice={setToast}
                                            onPid={(pid) => void openReferencedPid(pid, hole)}
                                        />
                                    )}
                                </Fragment>
                            ))}
                            {feedError && (
                                <div className="inline-error">
                                    <InformationRegular size={18} />
                                    {feedError}
                                </div>
                            )}
                            {page < lastPage && (
                                <div className="infinite-sentinel" ref={feedSentinelRef}>
                                    <Loading3Regular size={17} className="spin" />
                                    正在加载更多
                                </div>
                            )}
                            {page >= lastPage && (
                                <div className="feed-end">
                                    <span />
                                    已经到底了
                                    <span />
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <EmptyState mode={mode} searching={isSearching} />
                            {page < lastPage && (
                                <div className="infinite-sentinel" ref={feedSentinelRef}>
                                    <Loading3Regular size={17} className="spin" />
                                    正在继续查找
                                </div>
                            )}
                        </>
                    )}
                        </section>
                    </>
                )}
            </main>

            <aside className="right-rail">{renderSideTools('left')}</aside>

            <nav className="mobile-nav" aria-label="移动端导航">
                <button
                    type="button"
                    className={!docsOpen && mode === 'latest' ? 'active' : ''}
                    onClick={() => switchMode('latest')}>
                    <Home4Regular size={20} />
                    <span>最新</span>
                </button>
                <button
                    type="button"
                    className={!docsOpen && mode === 'bookmarks' ? 'active' : ''}
                    onClick={() => switchMode('bookmarks')}>
                    <BookmarkRegular size={20} />
                    <span>收藏</span>
                </button>
                <button type="button" className={docsOpen ? 'active' : ''} onClick={openDocumentation}>
                    <Book2Regular size={20} />
                    <span>文档</span>
                </button>
            </nav>

            {commentViewMode === 'modal' && selectedHole && (
                <CommentsPanel
                    hole={selectedHole}
                    displayMode="modal"
                    identities={postingIdentities}
                    onClose={() => setSelectedHole(null)}
                    onCommentPublished={() =>
                        updateHole(selectedHole.pid, (hole) => ({ ...hole, reply: hole.reply + 1 }))
                    }
                    onNotice={setToast}
                    onPid={(pid) => void openReferencedPid(pid, selectedHole)}
                />
            )}
            {currentDetailHole && (
                <div
                    className="drawer-layer hole-detail-layer"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="hole-detail-title">
                    <button
                        type="button"
                        className="drawer-scrim"
                        aria-label="关闭树洞详情"
                        onClick={closeHoleDetails}
                    />
                    <aside className="hole-detail-modal">
                        <header className="hole-detail-header">
                            <button
                                type="button"
                                className="detail-back"
                                disabled={detailStack.length <= 1}
                                onClick={goBackInHoleDetails}>
                                <ArrowLeftRegular size={18} />
                                <span>返回</span>
                            </button>
                            <div className="hole-detail-heading">
                                <strong id="hole-detail-title">#{currentDetailHole.pid}</strong>
                                <span>
                                    {detailStack.length > 1 ? `引用第 ${detailStack.length - 1} 层` : '来源树洞'}
                                </span>
                            </div>
                            {detailLoadingPid && (
                                <span className="detail-loading">
                                    <Loading3Regular className="spin" size={15} />
                                    正在打开 #{detailLoadingPid}
                                </span>
                            )}
                            <button
                                type="button"
                                className="detail-close"
                                aria-label="关闭全部树洞详情"
                                onClick={closeHoleDetails}>
                                <CloseRegular size={20} />
                            </button>
                        </header>
                        <div className="hole-detail-scroll">
                            <HoleRow
                                hole={currentDetailHole}
                                bookmarkOpen={bookmarkMenuPid === currentDetailHole.pid}
                                copyOpen={copyMenuPid === currentDetailHole.pid}
                                bookmarkGroups={bookmarkGroups}
                                bookmarkBusy={bookmarkBusy}
                                praiseBusy={likingPids.has(currentDetailHole.pid)}
                                onOpenComments={() =>
                                    document
                                        .getElementById(`detail-comments-${currentDetailHole.pid}`)
                                        ?.scrollIntoView({ behavior: 'smooth' })
                                }
                                onOpenBookmarkMenu={() => {
                                    setCopyMenuPid(null);
                                    setBookmarkMenuPid((current) =>
                                        current === currentDetailHole.pid ? null : currentDetailHole.pid,
                                    );
                                }}
                                onToggleBookmarkDirect={() => void toggleBookmarkDirect(currentDetailHole)}
                                onOpenCopyMenu={() => {
                                    setBookmarkMenuPid(null);
                                    setCopyMenuPid((current) =>
                                        current === currentDetailHole.pid ? null : currentDetailHole.pid,
                                    );
                                }}
                                onToggleBookmark={(group) => void toggleBookmarkFor(currentDetailHole, group)}
                                onCreateBookmark={(name) => void createBookmarkFor(currentDetailHole, name)}
                                onCopy={(includeComments) => {
                                    setCopyMenuPid(null);
                                    void copyHole(currentDetailHole, includeComments);
                                }}
                                onTogglePraise={() => void togglePraiseFor(currentDetailHole)}
                                onCopyPid={(pid) => void copyPid(pid)}
                                onOpenReferencedHole={(pid) => void openReferencedPid(pid, currentDetailHole)}
                                highlightTerms={[]}
                                blockingWords={blockingWords}
                            />
                            <div id={`detail-comments-${currentDetailHole.pid}`}>
                                <CommentsPanel
                                    key={`detail-comments-${currentDetailHole.pid}`}
                                    hole={currentDetailHole}
                                    displayMode="inline"
                                    identities={postingIdentities}
                                    onClose={closeHoleDetails}
                                    showClose={false}
                                    onCommentPublished={() =>
                                        updateHole(currentDetailHole.pid, (hole) => ({
                                            ...hole,
                                            reply: hole.reply + 1,
                                        }))
                                    }
                                    onNotice={setToast}
                                    onPid={(pid) => void openReferencedPid(pid, currentDetailHole)}
                                />
                            </div>
                        </div>
                    </aside>
                </div>
            )}
            <NotificationCenter
                open={notificationsOpen}
                onClose={() => setNotificationsOpen(false)}
                onOpenHole={(pid) => void openHoleDetails(pid)}
                onReadChanged={refreshUnreadCount}
            />
            <BlockingWordsDialog
                open={blockingWordsOpen}
                words={blockingWords}
                busy={blockingWordsBusy}
                onClose={() => setBlockingWordsOpen(false)}
                onSave={(words) => void saveBlockingWords(words)}
            />
            <BookmarkDeleteDialog
                target={bookmarkDeleteTarget}
                busy={bookmarkBusy}
                onClose={() => setBookmarkDeleteTarget(null)}
                onConfirm={() => void deleteBookmarkGroup()}
            />
            {toast && (
                <div className="toast" role="status">
                    <CheckRegular size={17} />
                    {toast}
                </div>
            )}
        </div>
    );
}
