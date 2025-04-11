import { join } from 'node:path'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import * as td from 'typedoc'
import { default as color } from 'cli-color'

export const getEntries = async (SRC_DIR: string, LIB_NAME: string) => {
  const regex = /@module\s+(@?[\w\/.-]+)/gm
  const entries: Record<string, string> = {}
  const filesInSrc = await readdir(SRC_DIR, {
    withFileTypes: true,
    recursive: true,
  })
  await Promise.all(
    filesInSrc.map(async (file) => {
      if (!file.isFile()) {
        return
      }
      if (!file.name.endsWith('.ts')) {
        return
      }
      const absPath = join(file.parentPath, file.name)
      const content = await readFile(absPath, 'utf-8')
      let m
      while ((m = regex.exec(content)) !== null) {
        if (m.index === regex.lastIndex) {
          regex.lastIndex++
        }
        m.forEach((match, gi) => {
          if (gi === 1) {
            const libMod = match.replace(LIB_NAME, '')
            let key = libMod.length === 0 ? 'index' : libMod
            while (key.startsWith('/')) {
              key = key.slice(1)
            }
            if (entries[key]) {
              throw new Error(`Duplicate entry: ${key}`)
            }
            entries[key] = absPath
          }
        })
      }
    })
  )
  return entries
}

interface Child {
  title: string
  kind: number
  path: string
  isDeprecated: boolean
  children?: Child[]
}

interface NavItem {
  text: string
  link?: string
  items?: NavItem[]
  collapsed?: boolean
}

const childToNav = (child: Child): NavItem => {
  if (child.children) {
    return {
      text: child.title,
      items: child.children.map(childToNav),
      collapsed: true,
    }
  }
  return {
    text: child.title,
    link: `/api/${child.path}`.replace(/\.md$/, ''),
  }
}

export const makeApiDocs = async (cwd: string, LIB_NAME: string) => {
  // this is where we build the markdown for the docs
  let app: td.Application | undefined
  const entries = await getEntries(join(cwd, 'src'), LIB_NAME)
  const entryPoints = Object.values(entries)
  try {
    app = await td.Application.bootstrapWithPlugins(
      {
        entryPoints: entryPoints,
        out: join(cwd, 'docs', 'api'),
        plugin: ['typedoc-plugin-markdown'],
        excludePrivate: true,
        excludeProtected: true,
        excludeExternals: true,
        hideGenerator: true,
        skipErrorChecking: true,
        readme: 'none',
        name: LIB_NAME,
        // @ts-ignore
        entryFileName: 'index.md',
        hidePageHeader: true,
        hideBreadcrumbs: true,
        useCodeBlocks: true,
        expandObjects: true,
        expandParameters: true,
        indexFormat: 'table',
        parametersFormat: 'table',
        interfacePropertiesFormat: 'table',
        classPropertiesFormat: 'table',
        typeAliasPropertiesFormat: 'table',
        enumMembersFormat: 'table',
        propertyMembersFormat: 'table',
        typeDeclarationFormat: 'table',
        formatWithPrettier: true,
        highlightLanguages: ['typescript', 'javascript', 'json'],
        disableSources: true,
        useTsLinkResolution: true,
        includeVersion: false,
      },
      [
        new td.ArgumentsReader(0),
        new td.TypeDocReader(),
        new td.PackageJsonReader(),
        new td.TSConfigReader(),
        new td.ArgumentsReader(300),
      ]
    )
    app.renderer.postRenderAsyncJobs.push(async (renderer) => {
      // The navigation JSON structure is available on the navigation object.
      // @ts-ignore
      const navigation = renderer.navigation.map((section) => {
        if (!section.children) {
          return {
            text: section.title,
            link: `/api/${section.path}`.replace(/\.md$/, ''),
          }
        }
        section.children = section.children.map(childToNav)
        if (entryPoints.length > 1) {
          section.children.unshift({
            text: 'Package Exports',
            link: `/api/${section.path}`.replace(/\.md$/, ''),
          })
        }
        return {
          text: section.title,
          items: section.children,
          collapsed: true,
        }
      })
      const sidebar = {
        text: 'API',
        items: [...navigation],
      }
      if (entryPoints.length === 1) {
        sidebar.items.unshift({ text: 'Package Exports', link: '/api' })
      }
      const dst = join(cwd, 'docs', '.vitepress', 'sidebar.json')
      await writeFile(dst, JSON.stringify(sidebar, null, 2))
      console.log(color.green('Sidebar JSON generated'))
    })
    const project = await app.convert()
    if (!project) {
      console.error(color.red('Typedoc failed to generate project'))
      return
    }
    app.validate(project)
    if (app.logger.hasErrors()) {
      console.error(color.red('Typedoc failed to generate project'))
      return
    }
    await app.generateOutputs(project)
    if (app.logger.hasErrors()) {
      console.error(color.red('Typedoc failed to generate project output'))
      return
    }
  } catch (error) {
    console.error(color.red(`Typedoc exited with an unexpected error`))
    console.error(error)
  }
}
