import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
)

const ADMIN_PIN = '7821'

export default function App() {
  const [user, setUser] = useState(null)

  const [continueWatching, setContinueWatching] = useState([])
  const [latestAdded, setLatestAdded] = useState([])
  const [popularMedia, setPopularMedia] = useState([])
  const [customCategories, setCustomCategories] = useState([])

  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    boot()
  }, [])

  async function boot() {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    setUser(user)

    if (localStorage.getItem('isAdmin') === 'true') {
      setIsAdmin(true)
    }

    loadHomepage(user)
  }

  async function loadHomepage(currentUser) {
    const latest = await supabase
      .from('media')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    setLatestAdded(latest.data || [])

    const popular = await supabase
      .from('most_popular_media')
      .select('*')
      .limit(20)

    setPopularMedia(popular.data || [])

    const custom = await supabase
      .from('custom_categories')
      .select(`
        *,
        category_items(
          *,
          media(*)
        )
      `)
      .order('position', { ascending: true })

    setCustomCategories(custom.data || [])

    if (currentUser?.id) {
      const watching = await supabase
        .from('watch_history')
        .select(`
          *,
          media(*)
        `)
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false })

      setContinueWatching(watching.data || [])
    }
  }

  async function registerMediaClick(mediaId) {
    const anonymousId =
      localStorage.getItem('anonymous_id') ||
      crypto.randomUUID()

    localStorage.setItem('anonymous_id', anonymousId)

    let query = supabase
      .from('media_clicks')
      .select('*')
      .eq('media_id', mediaId)

    if (user?.id) {
      query = query.eq('user_id', user.id)
    } else {
      query = query.eq('anonymous_id', anonymousId)
    }

    const { data } = await query.limit(1)

    if (!data?.length) {
      await supabase
        .from('media_clicks')
        .insert({
          media_id: mediaId,
          user_id: user?.id || null,
          anonymous_id: user?.id ? null : anonymousId
        })
    }
  }

  async function openMedia(media) {
    await registerMediaClick(media.id)

    window.location.href = `/watch/${media.id}`
  }

  async function removeFromHistory(mediaId) {
    if (!user) return

    await supabase
      .from('watch_history')
      .delete()
      .eq('user_id', user.id)
      .eq('media_id', mediaId)

    loadHomepage(user)
  }

  async function unlockAdmin() {
    const pin = prompt('PIN admina')

    if (pin === ADMIN_PIN) {
      localStorage.setItem('isAdmin', 'true')
      setIsAdmin(true)
      alert('Admin aktywowany')
    } else {
      alert('Błędny PIN')
    }
  }

  async function createCategory() {
    const name = prompt('Nazwa kategorii')

    if (!name) return

    await supabase
      .from('custom_categories')
      .insert({
        name
      })

    loadHomepage(user)
  }

  async function addMediaToCategory(categoryId) {
    const mediaId = prompt('ID filmu')

    if (!mediaId) return

    await supabase
      .from('category_items')
      .insert({
        category_id: categoryId,
        media_id: mediaId
      })

    loadHomepage(user)
  }

  function Row({ title, items, continueMode = false }) {
    return (
      <div style={{ marginBottom: 40 }}>
        <h2
          style={{
            marginBottom: 14,
            fontSize: 24,
            fontWeight: 700
          }}
        >
          {title}
        </h2>

        <div
          style={{
            display: 'flex',
            gap: 16,
            overflowX: 'auto',
            paddingBottom: 10
          }}
        >
          {items?.map(item => {
            const media = continueMode ? item.media : item

            if (!media) return null

            return (
              <div
                key={item.id}
                style={{
                  minWidth: 220,
                  position: 'relative',
                  cursor: 'pointer',
                  transition: '0.2s'
                }}
              >
                <img
                  src={
                    media.poster_path ||
                    media.backdrop_path
                  }
                  alt={media.title}
                  onClick={() => openMedia(media)}
                  style={{
                    width: '100%',
                    height: 124,
                    objectFit: 'cover',
                    borderRadius: 14
                  }}
                />

                {continueMode && (
                  <button
                    onClick={() =>
                      removeFromHistory(media.id)
                    }
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      border: 'none',
                      borderRadius: 999,
                      width: 28,
                      height: 28,
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                )}

                <div
                  style={{
                    marginTop: 8,
                    fontSize: 15,
                    fontWeight: 500
                  }}
                >
                  {media.title}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        background: '#0b0f1a',
        minHeight: '100vh',
        color: 'white',
        padding: 20
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 30
        }}
      >
        <h1
          style={{
            fontSize: 42,
            fontWeight: 800
          }}
        >
          FILMOZA
        </h1>

        <div
          style={{
            display: 'flex',
            gap: 10
          }}
        >
          {!isAdmin && (
            <button
              onClick={unlockAdmin}
              style={{
                padding: '10px 18px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Admin
            </button>
          )}

          {isAdmin && (
            <button
              onClick={createCategory}
              style={{
                padding: '10px 18px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Dodaj kategorię
            </button>
          )}
        </div>
      </div>

      {continueWatching.length > 0 && (
        <Row
          title='Kontynuuj oglądanie'
          items={continueWatching}
          continueMode={true}
        />
      )}

      <Row
        title='Ostatnio dodane'
        items={latestAdded}
      />

      <Row
        title='Najczęściej wybierane'
        items={popularMedia}
      />

      {customCategories.map(category => (
        <div key={category.id}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <h2
              style={{
                marginBottom: 14,
                fontSize: 24,
                fontWeight: 700
              }}
            >
              {category.name}
            </h2>

            {isAdmin && (
              <button
                onClick={() =>
                  addMediaToCategory(category.id)
                }
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Dodaj film
              </button>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              gap: 16,
              overflowX: 'auto',
              marginBottom: 40
            }}
          >
            {category.category_items?.map(item => (
              <div
                key={item.id}
                style={{
                  minWidth: 220,
                  cursor: 'pointer'
                }}
              >
                <img
                  src={
                    item.media?.poster_path ||
                    item.media?.backdrop_path
                  }
                  alt={item.media?.title}
                  onClick={() =>
                    openMedia(item.media)
                  }
                  style={{
                    width: '100%',
                    height: 124,
                    objectFit: 'cover',
                    borderRadius: 14
                  }}
                />

                <div
                  style={{
                    marginTop: 8,
                    fontSize: 15,
                    fontWeight: 500
                  }}
                >
                  {item.media?.title}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
